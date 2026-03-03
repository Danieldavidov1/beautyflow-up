// src/hooks/useActivityLogs.js
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useActivityLogs(customerId) {
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!customerId) { setActivityLogs([]); setLoading(false); return; }

    const q = query(
      collection(db, `customers/${customerId}/activity_logs`),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setActivityLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useActivityLogs]', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [customerId]);

  return { activityLogs, loading };
}
