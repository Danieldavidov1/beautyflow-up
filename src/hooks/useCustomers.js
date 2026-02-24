// src/hooks/useCustomers.js
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

// ── שדות חובה מינימליים ────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['name', 'phone'];

export function useCustomers() {
  const [customers, setCustomers]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [error,     setError]       = useState(null); // ✅ חדש
  const unsubscribeSnapshotRef      = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
        unsubscribeSnapshotRef.current = null;
      }

      if (!user) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      setError(null);

      const q = query(
        collection(db, 'customers'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubSnap = onSnapshot(
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

      unsubscribeSnapshotRef.current = unsubSnap;
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addCustomer = async (customerData) => {
    const user = auth.currentUser;
    if (!user) throw new Error('לא מחובר');

    // ✅ וולידציה — שם וטלפון חובה
    for (const field of REQUIRED_FIELDS) {
      if (!customerData[field]?.toString().trim()) {
        throw new Error(`שדה "${field}" הוא חובה`);
      }
    }

    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        // פרטים בסיסיים
        name:        customerData.name.trim(),
        phone:       customerData.phone.trim(),
        email:       customerData.email?.trim()       || '',
        birthdate:   customerData.birthdate           || null,
        gender:      customerData.gender              || '',
        // CRM
        notes:       customerData.notes?.trim()       || '',
        tags:        customerData.tags                || [],
        customerType: customerData.customerType       || 'regular', // regular / vip / new
        // רפואי
        medicalNotes:    customerData.medicalNotes?.trim()    || '',
        allergies:       customerData.allergies?.trim()       || '',
        // מערכת
        userId:      user.uid,
        businessId:  user.uid, // הכנה ל-Multi-Staff
        isActive:    true,
        totalVisits: 0,        // יתעדכן ע"י sub-collection appointments
        lastVisit:   null,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.error('[useCustomers] addCustomer error:', err);
      throw err;
    }
  };

  const updateCustomer = async (customerId, customerData) => {
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
  };

  const deleteCustomer = async (customerId) => {
    if (!customerId) throw new Error('חסר ID לקוח');
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (err) {
      console.error('[useCustomers] deleteCustomer error:', err);
      throw err;
    }
  };

  // ── Helpers client-side ───────────────────────────────────────────────────

  // ✅ חיפוש לפי שם / טלפון / תגיות
  const searchCustomers = useCallback((term = '') => {
    if (!term.trim()) return customers;
    const t = term.trim().toLowerCase();
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(t)  ||
      c.phone?.includes(t)               ||
      (c.tags ?? []).some((tag) => tag.toLowerCase().includes(t))
    );
  }, [customers]);

  // ✅ קבלת לקוח יחיד לפי ID (לעמוד כרטיס לקוחה)
  const getCustomerById = useCallback((id) =>
    customers.find((c) => c.id === id) ?? null,
  [customers]);

  return {
    customers,
    loading,
    error,           // ✅ חדש
    addCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomers, // ✅ חדש
    getCustomerById, // ✅ חדש
  };
}
