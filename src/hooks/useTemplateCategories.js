// src/hooks/useTemplateCategories.js
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

const DEFAULT_CATEGORIES = [
  { id: 'reminders',  label: 'תזכורות',       color: 'bg-blue-100   text-blue-600   dark:bg-blue-900/30   dark:text-blue-400'   },
  { id: 'marketing',  label: 'שיווק',         color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'followup',   label: 'פולו-אפ',       color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'first_time', label: 'לקוחות חדשות', color: 'bg-green-100  text-green-600  dark:bg-green-900/30  dark:text-green-400'  },
  { id: 'general',    label: 'כללי',          color: 'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-300'   },
];

export function useTemplateCategories() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading]       = useState(true);
  const unsubSnapRef = useRef(null); // ← עקבי עם useTasks / useTemplates

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnapRef.current) {
        unsubSnapRef.current();
        unsubSnapRef.current = null;
      }

      if (!user) {
        setCategories(DEFAULT_CATEGORIES);
        setLoading(false);
        return;
      }

      const ref = doc(db, 'userSettings', user.uid);

      unsubSnapRef.current = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists() && Array.isArray(snap.data().templateCategories)) {
            setCategories(snap.data().templateCategories);
          } else {
            // משתמש חדש — יוצר מסמך עם ברירות המחדל
            setDoc(ref, { templateCategories: DEFAULT_CATEGORIES }, { merge: true })
              .catch((e) => console.error('[useTemplateCategories] seed error:', e));
            setCategories(DEFAULT_CATEGORIES);
          }
          setLoading(false);
        },
        (err) => {
          console.error('[useTemplateCategories] onSnapshot error:', err);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubSnapRef.current) unsubSnapRef.current();
    };
  }, []);

  const saveCategories = async (newList) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(
        doc(db, 'userSettings', user.uid),
        { templateCategories: newList },
        { merge: true } // ← לא מוחק שדות עתידיים כמו theme, notifications וכו'
      );
    } catch (err) {
      console.error('[useTemplateCategories] saveCategories error:', err);
      throw err;
    }
  };

  return { categories, loading, saveCategories };
}
