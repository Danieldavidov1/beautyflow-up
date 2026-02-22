// src/hooks/useCategoriesFirestore.js
import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, where, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// ✅ ללא orderBy — מיון בצד הלקוח (מונע דרישת index)
const DEFAULT_CATEGORIES = {
  goals: [
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
  
  // ✅ useRef במקום useState — לא מפעיל re-render/useEffect מחדש
  const seededRef = useRef(false);

  useEffect(() => {
    // ✅ איפוס seeded בכל פעם שה-type משתנה
    seededRef.current = false;
    let unsubscribeSnapshot = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeSnapshot();

      if (!user) {
        setCategories([]);
        setLoading(false);
        return;
      }

      // ✅ רק 2 תנאי where — ללא orderBy — אין צורך ב-index
      const q = query(
        collection(db, 'categories'),
        where('userId', '==', user.uid),
        where('type', '==', type)
      );

      unsubscribeSnapshot = onSnapshot(q,
        async (snap) => {
          if (snap.empty && !seededRef.current) {
            // ✅ זריעת ברירות מחדל פעם אחת בלבד
            seededRef.current = true;
            try {
              const batch = writeBatch(db);
              (DEFAULT_CATEGORIES[type] || []).forEach(cat => {
                const ref = doc(collection(db, 'categories'));
                batch.set(ref, {
                  ...cat,
                  userId: user.uid,
                  type,
                  createdAt: new Date()
                });
              });
              await batch.commit();
              // snapshot יתעדכן אוטומטית
            } catch (err) {
              console.error('seed error:', err);
              setLoading(false);
            }
          } else {
            // ✅ תיקון ספינר: תמיד מעדכן — גם אם ריק אחרי מחיקה
            const data = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              // ✅ מיון ב-JS במקום orderBy
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
    };
  }, [type]);

  // ✅ הוסף קטגוריה
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

  // ✅ עדכן קטגוריה
  const updateCategory = async (id, name, color) => {
    try {
      await updateDoc(doc(db, 'categories', id), { name, color });
    } catch (error) {
      console.error('updateCategory error:', error);
      throw error;
    }
  };

  // ✅ מחק קטגוריה
  const deleteCategory = async (id) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error('deleteCategory error:', error);
      throw error;
    }
  };

  // ✅ סדר מחדש אחרי drag & drop
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
