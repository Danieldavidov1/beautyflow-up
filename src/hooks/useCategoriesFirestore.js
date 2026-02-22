// src/hooks/useCategoriesFirestore.js
import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, where, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';

const DEFAULT_CATEGORIES = {
  goal: [
    { name: 'חיסכון',        color: '#8b5cf6', order: 0 },
    { name: 'הכנסות',        color: '#10b981', order: 1 },
    { name: 'השקעה',         color: '#3b82f6', order: 2 },
    { name: 'צמצום הוצאות', color: '#f97316', order: 3 },
    { name: 'אחר',           color: '#6b7280', order: 4 },
  ],
  income: [
    { name: 'משכורת',  color: '#10b981', order: 0 },
    { name: 'פרילנס',  color: '#3b82f6', order: 1 },
    { name: 'השקעות',  color: '#8b5cf6', order: 2 },
    { name: 'אחר',     color: '#6b7280', order: 3 },
  ],
  expense: [
    { name: 'מזון',      color: '#ef4444', order: 0 },
    { name: 'תחבורה',   color: '#f97316', order: 1 },
    { name: 'בריאות',   color: '#10b981', order: 2 },
    { name: 'בידור',    color: '#8b5cf6', order: 3 },
    { name: 'אחר',      color: '#6b7280', order: 4 },
  ]
};

export function useCategoriesFirestore(type) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  useEffect(() => {
    seededRef.current = false;
    let unsubscribeSnapshot = () => {};
    let offlineTimer = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeSnapshot();
      if (offlineTimer) clearTimeout(offlineTimer);

      if (!user) {
        setCategories([]);
        setLoading(false);
        return;
      }

      const seedKey = `seeded_${user.uid}_${type}`;

      const q = query(
        collection(db, 'categories'),
        where('userId', '==', user.uid),
        where('type', '==', type)
      );

      // ✅ includeMetadataChanges: true — מאפשר זיהוי cache vs server
      unsubscribeSnapshot = onSnapshot(q, { includeMetadataChanges: true },
        async (snap) => {
          if (offlineTimer) clearTimeout(offlineTimer);

          // ✅ תיקון 1: snapshot ריק מה-cache → המתן לשרת, אבל עם timeout
          if (snap.empty && snap.metadata.fromCache) {
            offlineTimer = setTimeout(() => {
              setLoading(false); // fallback אם השרת לא עונה
            }, 8000);
            return;
          }

          // ✅ תיקון 3: התעלם מ-metadata-only updates (כפילויות רינדור)
          // רק אם יש שינוי בנתונים עצמם נמשיך
          if (!snap.empty && snap.metadata.hasPendingWrites && snap.metadata.fromCache) {
            // עדכון אופטימיסטי מקומי — תקין, נמשיך לעבד
          }

          const hasSeededLocally = localStorage.getItem(seedKey) === 'true';

          // ✅ תיקון 2: seed רק אם ריק מהשרת (לא cache) ולא זרענו כבר
          if (snap.empty && !snap.metadata.fromCache && !seededRef.current && !hasSeededLocally) {
            seededRef.current = true;
            localStorage.setItem(seedKey, 'true');

            try {
              const batch = writeBatch(db);
              const defaultsToUse = DEFAULT_CATEGORIES[type] || [];

              defaultsToUse.forEach(cat => {
                const ref = doc(collection(db, 'categories'));
                batch.set(ref, {
                  ...cat,
                  userId: user.uid,
                  type,
                  createdAt: new Date()
                });
              });
              await batch.commit();
              setLoading(false);
            } catch (err) {
              console.error('seed error:', err);
              setLoading(false);
            }
          } else {
            // ✅ שליפה רגילה — כולל snapshot ריק לאחר מחיקה לגיטימית
            const data = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            // ✅ תיקון 2: אם יש קטגוריות — עדכן localStorage (לתרחיש דפדפן חדש)
            if (data.length > 0) {
              localStorage.setItem(seedKey, 'true');
            }

            setCategories(data);
            setLoading(false);
          }
        },
        (error) => {
          console.error('useCategoriesFirestore error:', error);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
      if (offlineTimer) clearTimeout(offlineTimer);
    };
  }, [type]);

  const addCategory = async (name, color) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: name.trim(),
        color,
        order: categories.length,
        type,
        userId: user.uid,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('addCategory error:', error);
      throw error;
    }
  };

  const updateCategory = async (id, name, color) => {
    try {
      await updateDoc(doc(db, 'categories', id), { name, color });
    } catch (error) {
      console.error('updateCategory error:', error);
      throw error;
    }
  };

  const deleteCategory = async (id) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error('deleteCategory error:', error);
      throw error;
    }
  };

  const reorderCategories = async (newOrder) => {
    try {
      const batch = writeBatch(db);
      newOrder.forEach((cat, index) => {
        batch.update(doc(db, 'categories', cat.id), { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error('reorderCategories error:', error);
      throw error;
    }
  };

  return {
    categories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories
  };
}
