// src/hooks/useTransactions.js
import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useTransactions(type) {
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    let unsubscribeSnapshot = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeSnapshot(); // נקה snapshot קודם

      if (!user) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      setLoading(true); // ✅ reset לפני טעינה חדשה
      setError(null);

      const constraints = [
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
      ];

      // ✅ אם type הועבר — מסנן לפיו, אחרת מביא הכל
      if (type) {
        constraints.splice(1, 0, where('type', '==', type));
      }

      const q = query(collection(db, 'transactions'), ...constraints);

      unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('[useTransactions] onSnapshot error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, [type]);

  const addTransaction = async (transactionData) => {
    const user = auth.currentUser;
    if (!user) throw new Error('לא מחובר');

    try {
      const docRef = await addDoc(collection(db, 'transactions'), {
        ...transactionData,
        // type מה-hook גובר על מה שהועבר בנתונים (אם קיים)
        type:      type ?? transactionData.type ?? 'income',
        userId:    user.uid,
        createdAt: serverTimestamp(), // ✅ עקבי עם שאר ה-hooks במערכת
      });
      return docRef.id;
    } catch (err) {
      console.error('[useTransactions] addTransaction error:', err);
      throw err;
    }
  };

  return { transactions, loading, error, addTransaction };
}