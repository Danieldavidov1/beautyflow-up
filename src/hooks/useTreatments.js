// src/hooks/useTreatments.js
import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp,
  increment, updateDoc, getDocs, limit,
} from 'firebase/firestore';
import { db } from '../firebase';

export function useTreatments(customerId) {
  const [treatments, setTreatments] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!customerId) {
      setTreatments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `customers/${customerId}/treatments`),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setTreatments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useTreatments] error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [customerId]);

  // ── Add ──────────────────────────────────────────────────────────────────
  const addTreatment = async (treatmentData) => {
    if (!customerId) throw new Error('חסר ID לקוחה');
    try {
      await addDoc(collection(db, `customers/${customerId}/treatments`), {
        ...treatmentData,
        price:     Number(treatmentData.price) || 0,
        createdAt: serverTimestamp(),
      });

      // ✅ עדכון totalVisits + lastVisit בכרטיס הראשי
      await updateDoc(doc(db, 'customers', customerId), {
        totalVisits: increment(1),
        lastVisit:   treatmentData.date,
        updatedAt:   serverTimestamp(),
      });
    } catch (err) {
      console.error('[useTreatments] addTreatment error:', err);
      throw err;
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteTreatment = async (treatmentId) => {
    if (!customerId || !treatmentId) return;
    try {
      await deleteDoc(
        doc(db, `customers/${customerId}/treatments`, treatmentId)
      );

      // ✅ מוריד totalVisits + מחשב מחדש את lastVisit מהטיפול הכי חדש שנשאר
      const remaining = await getDocs(
        query(
          collection(db, `customers/${customerId}/treatments`),
          orderBy('date', 'desc'),
          limit(1)
        )
      );
      const newLastVisit = remaining.empty
        ? null
        : remaining.docs[0].data().date;

      await updateDoc(doc(db, 'customers', customerId), {
        totalVisits: increment(-1),
        lastVisit:   newLastVisit,
        updatedAt:   serverTimestamp(),
      });
    } catch (err) {
      console.error('[useTreatments] deleteTreatment error:', err);
      throw err;
    }
  };

  return { treatments, loading, error, addTreatment, deleteTreatment };
}
