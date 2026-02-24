// src/hooks/useAppointments.js
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    // ✅ זהה לכל שאר ה-Hooks — auth.currentUser ישיר
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'appointments'),
      where('userId', '==', user.uid), // ✅ עקביות עם שאר הקולקציות
      orderBy('date',      'asc'),
      orderBy('startTime', 'asc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setAppointments(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useAppointments] error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addAppointment = async (data) => {
    const user = auth.currentUser;
    if (!user) throw new Error('לא מחובר');
    try {
      const ref = await addDoc(collection(db, 'appointments'), {
        ...data,
        userId:     user.uid, // ✅ תואם ל-Rules isOwner(data)
        businessId: user.uid, // שמור גם לעתיד Multi-Staff
        status:     data.status ?? 'scheduled',
        createdAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
      });
      return ref.id;
    } catch (err) {
      console.error('[useAppointments] add error:', err);
      throw err;
    }
  };

  const updateAppointment = async (id, data) => {
    if (!id) throw new Error('חסר מזהה תור');
    try {
      await updateDoc(doc(db, 'appointments', id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[useAppointments] update error:', err);
      throw err;
    }
  };

  const deleteAppointment = async (id) => {
    if (!id) throw new Error('חסר מזהה תור');
    try {
      await deleteDoc(doc(db, 'appointments', id));
    } catch (err) {
      console.error('[useAppointments] delete error:', err);
      throw err;
    }
  };

  // ── Selectors (Client-side) ───────────────────────────────────────────────

  // ✅ שולף תורים לתאריך ספציפי (YYYY-MM-DD)
  const getByDate = useCallback((dateStr) =>
    appointments.filter((a) => a.date === dateStr),
  [appointments]);

  // ✅ שולף תורים לשבוע שלם (מערך של 7 תאריכים)
  const getByWeek = useCallback((weekDates) => {
    const set = new Set(weekDates);
    return appointments.filter((a) => set.has(a.date));
  }, [appointments]);

  // ✅ תור לפי ID
  const getById = useCallback((id) =>
    appointments.find((a) => a.id === id) ?? null,
  [appointments]);

  // ✅ סטטיסטיקה — מספר תורים לפי סטטוס
  const stats = {
    scheduled: appointments.filter((a) => a.status === 'scheduled').length,
    completed:  appointments.filter((a) => a.status === 'completed').length,
    cancelled:  appointments.filter((a) => a.status === 'cancelled').length,
    total:      appointments.length,
  };

  return {
    appointments,
    loading,
    error,
    stats,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    getByDate,
    getByWeek,
    getById,
  };
}
