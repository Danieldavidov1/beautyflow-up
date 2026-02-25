// src/hooks/useServices.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export function useServices() {
  const [services, setServices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [userId, setUserId]       = useState(null);

  // ─── האזנה לשינוי Auth (בטוח יותר מ-auth.currentUser) ───────────
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
      if (!user) setLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── האזנה לשירותים ב-Firestore ──────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const q = query(
      collection(db, 'services'),
      where('userId', '==', userId),
      orderBy('title', 'asc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setServices(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useServices] snapshot error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  // ─── הוספת שירות ─────────────────────────────────────────────────
  const addService = useCallback(async (data) => {
    if (!userId) throw new Error('לא מחובר');

    const docRef = await addDoc(collection(db, 'services'), {
      title:       String(data.title ?? '').trim(),
      duration:    Math.max(1, Number(data.duration) || 60),   // דקות, מינ' 1
      price:       Math.max(0, Number(data.price)    || 0),    // ₪, מינ' 0
      color:       data.color    ?? '#e5007e',                  // צבע לUI
      isActive:    data.isActive ?? true,                       // פעיל/מושבת
      notes:       String(data.notes ?? '').trim(),             // הערות
      userId,
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });

    return docRef.id;
  }, [userId]);

  // ─── עדכון שירות ─────────────────────────────────────────────────
  const updateService = useCallback(async (id, data) => {
    if (!id) throw new Error('חסר ID');

    const payload = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    if ('title'    in data) payload.title    = String(data.title).trim();
    if ('duration' in data) payload.duration = Math.max(1, Number(data.duration) || 60);
    if ('price'    in data) payload.price    = Math.max(0, Number(data.price)    || 0);

    await updateDoc(doc(db, 'services', id), payload);
  }, []);

  // ─── מחיקת שירות ─────────────────────────────────────────────────
  const deleteService = useCallback(async (id) => {
    if (!id) throw new Error('חסר ID');
    await deleteDoc(doc(db, 'services', id));
  }, []);

  // ─── השבתת שירות (soft delete) ───────────────────────────────────
  const toggleServiceActive = useCallback(async (id, currentState) => {
    await updateDoc(doc(db, 'services', id), {
      isActive:  !currentState,
      updatedAt: serverTimestamp(),
    });
  }, []);

  // ─── שליפה מהירה לפי ID (שימושי בטופס התור) ─────────────────────
  const getServiceById = useCallback(
    (id) => services.find((s) => s.id === id) ?? null,
    [services]
  );

  // ─── רק שירותים פעילים (לשימוש בטופס התור) ──────────────────────
  const activeServices = useMemo(
    () => services.filter((s) => s.isActive !== false),
    [services]
  );

  return {
    services,           // כל השירותים (כולל מושבתים)
    activeServices,     // שירותים פעילים בלבד
    loading,
    error,
    addService,
    updateService,
    deleteService,
    toggleServiceActive,
    getServiceById,
  };
}
