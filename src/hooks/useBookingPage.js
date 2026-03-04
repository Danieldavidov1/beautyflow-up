// src/hooks/useBookingPage.js
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, getDocs,
  doc, getDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';


// ── Helpers ──────────────────────────────────────────────────────────────────


export function toMin(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}


export function toTimeStr(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}


export function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}


export function toDateStr(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}


// ── Validation ────────────────────────────────────────────────────────────────
function validateBookingPayload(data) {
  const title = data.serviceTitle || data.title;
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('יש לבחור לפחות טיפול אחד');
  }
  const duration = data.serviceDuration || data.duration;
  if (!duration || Number(duration) <= 0) {
    throw new Error('משך הטיפול לא תקין');
  }
  if (!data.date || data.date.length !== 10) {
    throw new Error('תאריך לא תקין');
  }
  if (!data.startTime || data.startTime.length !== 5) {
    throw new Error('שעה לא תקינה');
  }
  if (!data.guestName || data.guestName.trim().length < 2) {
    throw new Error('שם לא תקין');
  }
  if (!data.guestPhone || data.guestPhone.trim().length < 9) {
    throw new Error('טלפון לא תקין');
  }
  if (data.notes && data.notes.length > 300) {
    throw new Error('הערות ארוכות מדי');
  }
}


// ── Hook ──────────────────────────────────────────────────────────────────────
export function useBookingPage(providerId) {

  const [providerSettings, setProviderSettings] = useState(null);
  const [services,         setServices]         = useState([]);
  const [loadingInitial,   setLoadingInitial]   = useState(true);
  const [errorInitial,     setErrorInitial]     = useState(null);
  const [bookedSlots,      setBookedSlots]      = useState([]);
  const [loadingSlots,     setLoadingSlots]     = useState(false);
  const [submitting,       setSubmitting]       = useState(false);


  // ── 1. טעינה ראשונית ────────────────────────────────────────────
  useEffect(() => {
    if (!providerId) {
      setErrorInitial('קישור לא תקין — חסר מזהה עסק');
      setLoadingInitial(false);
      return;
    }

    let cancelled = false;

    async function fetchInitialData() {
      try {
        const settingsSnap = await getDoc(doc(db, 'userSettings', providerId));
        if (cancelled) return;

        setProviderSettings(
          settingsSnap.exists()
            ? settingsSnap.data()
            : { businessName: 'קביעת תור', businessHours: {} }
        );

        const srvSnap = await getDocs(query(
          collection(db, 'services'),
          where('userId',   '==', providerId),
          where('isActive', '==', true),
        ));
        if (cancelled) return;

        setServices(srvSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      } catch (err) {
        console.error('[useBookingPage] fetchInitialData:', err);
        if (!cancelled) setErrorInitial('שגיאה בטעינת נתוני העסק. אנא נסי מאוחר יותר.');
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    }

    fetchInitialData();
    return () => { cancelled = true; };
  }, [providerId]);


  // ── 2. שליפת תורים תפוסים וחסומים ─────────────────────────────
  // ✅ תיקון בעיה 2: שאילתה אחת שמחזירה גם תורים רגילים וגם חסימות
  // חסכון בעלות שרת: query אחד במקום שניים, עם OR על status
  const fetchBookedSlots = useCallback(async (selectedDate) => {
    if (!providerId || !selectedDate) return [];

    setLoadingSlots(true);
    try {
      const aptSnap = await getDocs(query(
        collection(db, 'appointments'),
        where('userId', '==', providerId),
        where('date',   '==', selectedDate),
        where('status', 'in', ['scheduled', 'completed', 'blocked']), // ✅ נוסף 'blocked'
      ));

      const slots = aptSnap.docs.map((d) => d.data());
      setBookedSlots(slots);
      return slots;
    } catch (err) {
      console.error('[useBookingPage] fetchBookedSlots:', err);
      setBookedSlots([]);
      return [];
    } finally {
      setLoadingSlots(false);
    }
  }, [providerId]);


  // ── 3. חישוב שעות פנויות ────────────────────────────────────────
  // ✅ תיקון בעיה 2 (חלק ב): חסימות "כל היום" (00:00–23:59) חוסמות את כל היום
  const calculateAvailableSlots = useCallback((selectedDate, serviceDuration, currentBookedSlots) => {
    if (!providerSettings || !selectedDate || !serviceDuration) return [];

    const dayIndex = parseDateStr(selectedDate).getDay();
    const dayCfg   = providerSettings.businessHours?.[dayIndex];

    if (!dayCfg || !dayCfg.isActive) return [];
    if (providerSettings.closedDays?.includes(selectedDate)) return [];

    const openMin    = toMin(dayCfg.start);
    const closeMin   = toMin(dayCfg.end);
    const duration   = Number(serviceDuration);
    const slotStep   = 30;
    const nowMs      = Date.now();
    const slotsToUse = currentBookedSlots ?? bookedSlots;

    // ✅ בדיקת חסימת יום שלם (isAllDay) — אם קיימת, מחזירים מיד מערך ריק
    const isFullDayBlocked = slotsToUse.some(
      (apt) => apt.isBlocked && apt.startTime === '00:00' && apt.endTime === '23:59'
    );
    if (isFullDayBlocked) return [];

    const slots = [];

    for (let cur = openMin; cur + duration <= closeMin; cur += slotStep) {
      const slotEnd = cur + duration;
      const slotMs  = new Date(`${selectedDate}T${toTimeStr(cur)}:00`).getTime();
      if (slotMs < nowMs) continue;

      const hasOverlap = slotsToUse.some((apt) => {
        const aptStart = toMin(apt.startTime);
        const aptEnd   = toMin(apt.endTime);
        return cur < aptEnd && slotEnd > aptStart; // ✅ עובד גם על blocked
      });

      if (!hasOverlap) slots.push(toTimeStr(cur));
    }

    return slots;
  }, [providerSettings, bookedSlots]);


  // ── 4. שליחת בקשה ───────────────────────────────────────────────
  const submitBookingRequest = useCallback(async (bookingData) => {
    if (!providerId) throw new Error('חסר מזהה עסק');
    if (submitting)  throw new Error('כבר בתהליך שליחה');

    validateBookingPayload(bookingData);

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'bookingRequests'), {
        ...bookingData,
        ownerUid:  providerId,
        status:    'pending',
        createdAt: serverTimestamp(),
      });

      return { docId: docRef.id, autoConfirmed: false };
    } catch (err) {
      console.error('[useBookingPage] submitBookingRequest:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [providerId, submitting]);


  return {
    providerSettings,
    services,
    loadingInitial,
    errorInitial,
    bookedSlots,
    loadingSlots,
    fetchBookedSlots,
    calculateAvailableSlots,
    submitting,
    submitBookingRequest,
  };
}
