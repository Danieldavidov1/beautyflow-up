import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useTransactions(type) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ משתנה שמחזיק את ה-snapshot unsubscribe
    let unsubscribeSnapshot = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // ✅ נקה snapshot קודם לפני שפותחים חדש
      unsubscribeSnapshot();

      if (user) {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid),
          where('type', '==', type),
          orderBy('date', 'desc')
        );

        unsubscribeSnapshot = onSnapshot(q,
          (snapshot) => {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setTransactions(data);
            setLoading(false);
          },
          (error) => {
            console.error('useTransactions error:', error);
            if (error.code === 'permission-denied') {
              console.warn('Firestore permission denied for transactions');
            }
            setLoading(false);
          }
        );
      } else {
        // משתמש לא מחובר
        setTransactions([]);
        setLoading(false);
      }
    });

    // ✅ cleanup נכון — מנקה את שניהם
    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, [type]);

  const addTransaction = async (transaction) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        ...transaction,
        userId: user.uid,
        type,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('addTransaction error:', error);
      throw error; // ✅ זורק כדי שהקומפוננט יוכל לתפוס
    }
  };

  return { transactions, loading, addTransaction };
}
