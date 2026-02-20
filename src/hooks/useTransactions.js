import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useTransactions(type) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      where('type', '==', type),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [type]);

  const addTransaction = async (transaction) => {
    const userId = auth.currentUser?.uid;
    await addDoc(collection(db, 'transactions'), {
      ...transaction,
      userId,
      type,
      date: new Date().toISOString()
    });
  };

  return { transactions, loading, addTransaction };
}
