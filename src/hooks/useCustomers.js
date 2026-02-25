// src/hooks/useCustomers.js
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

// phone הוסר מחובה — מאפשר יצירה מהירה מהיומן עם שם בלבד
const REQUIRED_FIELDS = ['name'];

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const unsubscribeSnapshotRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // מנתק snapshot קודם בכל שינוי auth
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (!user) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const q = query(
        collection(db, 'customers'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      unsubscribeSnapshotRef.current = onSnapshot(
        q,
        (snapshot) => {
          setCustomers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('[useCustomers] onSnapshot error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addCustomer = useCallback(async (customerData) => {
    const user = auth.currentUser;
    if (!user) throw new Error('לא מחובר');

    // וולידציה — רק שם חובה
    for (const field of REQUIRED_FIELDS) {
      if (!customerData[field]?.toString().trim()) {
        throw new Error(`שדה "${field}" הוא חובה`);
      }
    }

    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        name:         customerData.name.trim(),
        phone:        customerData.phone?.trim()        || '',
        email:        customerData.email?.trim()        || '',
        birthdate:    customerData.birthdate            || null,
        gender:       customerData.gender               || '',
        notes:        customerData.notes?.trim()        || '',
        tags:         customerData.tags                 || [],
        customerType: customerData.customerType         || 'regular',
        medicalNotes: customerData.medicalNotes?.trim() || '',
        allergies:    customerData.allergies?.trim()    || '',
        userId:       user.uid,
        businessId:   user.uid,
        isActive:     true,
        totalVisits:  0,
        lastVisit:    null,
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
      return docRef.id; // ✅ מחזיר id — נדרש ע"י Calendar.jsx
    } catch (err) {
      console.error('[useCustomers] addCustomer error:', err);
      throw err;
    }
  }, []);

  const updateCustomer = useCallback(async (customerId, customerData) => {
    if (!customerId) throw new Error('חסר ID לקוח');
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        ...customerData,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[useCustomers] updateCustomer error:', err);
      throw err;
    }
  }, []);

  const deleteCustomer = useCallback(async (customerId) => {
    if (!customerId) throw new Error('חסר ID לקוח');
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (err) {
      console.error('[useCustomers] deleteCustomer error:', err);
      throw err;
    }
  }, []);

  // ── Helpers client-side ───────────────────────────────────────────────────

  const searchCustomers = useCallback((term = '') => {
    if (!term.trim()) return customers;
    const t = term.trim().toLowerCase();
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(t) ||
      c.phone?.includes(t)              ||
      (c.tags ?? []).some((tag) => tag.toLowerCase().includes(t))
    );
  }, [customers]);

  const getCustomerById = useCallback((id) =>
    customers.find((c) => c.id === id) ?? null,
  [customers]);

  return {
    customers,
    loading,
    error,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    SearchCustomers: searchCustomers, // backward compat אם בשימוש
    searchCustomers,
    getCustomerById,
  };
}
