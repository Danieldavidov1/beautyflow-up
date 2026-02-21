import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useTransactions(type) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ מאזין לשינויים ב-Auth - פותר את בעיית ה-GSAP וה-loading
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid),
          where('type', '==', type),
          orderBy('date', 'desc')
        );

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setTransactions(data);
          setLoading(false); // ✅ רק אחרי שהנתונים הגיעו
        });

        // ✅ מנקה snapshot listener כשמשתמש מתנתק
        return () => unsubscribeSnapshot();
      } else {
        // ✅ משתמש לא מחובר - מאפס הכל
        setTransactions([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [type]);

  const addTransaction = async (transaction) => {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, 'transactions'), {
      ...transaction,
      userId: user.uid,
      type,
      // ✅ שומר את התאריך שהמשתמש בחר, לא תאריך עכשיו
      createdAt: new Date().toISOString()
    });
  };

  return { transactions, loading, addTransaction };
}
