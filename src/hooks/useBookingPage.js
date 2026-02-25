// src/hooks/useBookingPage.js
// ─────────────────────────────────────────────────────────────────────────────
// Hook לניהול כל הלוגיקה של דף קביעת תור הציבורי
// משמש: BookingPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, getDocs,
  doc, getDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';

// ── Helpers ──────────────────────────────────────────────────────────────────
// ✅ מיוצאים — BookingPage.jsx יכול לייבא מכאן ולא להגדיר מחדש (מונע כפילות)

export function toMin(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function toTimeStr(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

// ✅ תיקון timezone: new Date(str) מפרש כ-UTC ומחזיר יום שגוי.
// הוספת T12:00:00 מבטיחה שהתאריך ייפרש תמיד כשעה מקומית
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

// ── וולידציה לפני שליחה לענן ─────────────────────────────────────────────────
// ✅ שכבת הגנה נוספת בצד ה-client לפני שה-Firestore Rules יבדקו
function validateBookingPayload(data) {
  if (!data.serviceId  || typeof data.serviceId  !== 'string') throw new Error('שירות לא תקין');
  if (!data.date       || data.date.length !== 10)              throw new Error('תאריך לא תקין');
  if (!data.startTime  || data.startTime.length !== 5)          throw new Error('שעה לא תקינה');
  if (!data.guestName  || data.guestName.trim().length < 2)     throw new Error('שם לא תקין');
  if (!data.guestPhone || data.guestPhone.trim().length < 9)    throw new Error('טלפון לא תקין');
  if (data.notes && data.notes.length > 300)                    throw new Error('הערות ארוכות מדי');
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBookingPage(providerId) {

  // ── נתוני עסק ──────────────────────────────────────────────────
  const [providerSettings, setProviderSettings] = useState(null);
  const [services,         setServices]         = useState([]);
  const [loadingInitial,   setLoadingInitial]   = useState(true);
  const [errorInitial,     setErrorInitial]     = useState(null);

  // ── slots ───────────────────────────────────────────────────────
  const [bookedSlots,  setBookedSlots]  = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ── שליחה ──────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── 1. טעינה ראשונית: הגדרות עסק + מחירון ─────────────────────
  useEffect(() => {
    if (!providerId) {
      setErrorInitial('קישור לא תקין — חסר מזהה עסק');
      setLoadingInitial(false);
      return;
    }

    let cancelled = false; // ✅ cleanup flag — מונע state update על קומפוננט שנוסר

    async function fetchInitialData() {
      try {
        // א. הגדרות עסק: שם, שעות פעילות, ימי חופשה
        // ✅ דורש Firebase Rule: match /userSettings/{userId} { allow get: if true; }
        const settingsSnap = await getDoc(doc(db, 'userSettings', providerId));
        if (cancelled) return;

        setProviderSettings(
          settingsSnap.exists()
            ? settingsSnap.data()
            : { businessName: 'קביעת תור', businessHours: {} }
        );

        // ב. מחירון — שירותים פעילים בלבד
        // ✅ דורש Firebase Rule: match /services/{serviceId} { allow read: if true; }
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
    return () => { cancelled = true; }; // ✅ cleanup על unmount
  }, [providerId]);

  // ── 2. שליפת תורים תפוסים לתאריך ספציפי ──────────────────────
  // ✅ מחזיר את המערך ישירות (ולא רק מעדכן state) — מונע race condition
  // בו calculateAvailableSlots רץ לפני ש-setBookedSlots סיים
  const fetchBookedSlots = useCallback(async (selectedDate) => {
    if (!providerId || !selectedDate) return [];

    setLoadingSlots(true);
    try {
      // ✅ דורש Firebase Rule: appointments allow read עם userId תואם
      const aptSnap = await getDocs(query(
        collection(db, 'appointments'),
        where('userId', '==', providerId),
        where('date',   '==', selectedDate),
        where('status', 'in', ['scheduled', 'completed']),
        // ✅ תורים מבוטלים לא חוסמים שעות
      ));

      const slots = aptSnap.docs.map((d) => d.data());
      setBookedSlots(slots); // לסנכרון ה-UI
      return slots;          // ✅ מחזיר ישירות לקורא לחישוב מיידי
    } catch (err) {
      console.error('[useBookingPage] fetchBookedSlots:', err);
      setBookedSlots([]);
      return []; // ✅ fallback בטוח — לא נחסום slots בגלל שגיאת רשת
    } finally {
      setLoadingSlots(false);
    }
  }, [providerId]);

  // ── 3. חישוב שעות פנויות ──────────────────────────────────────
  // ✅ תוקן: מקבל את bookedSlots כפרמטר (ולא קורא מ-state)
  // מונע race condition שבו החישוב רץ על slots ישנים
  const calculateAvailableSlots = useCallback((selectedDate, serviceDuration, currentBookedSlots) => {
    if (!providerSettings || !selectedDate || !serviceDuration) return [];

    // ✅ תיקון timezone: parseDateStr עם T12:00 — getDay() יחזיר יום נכון
    const dayIndex = parseDateStr(selectedDate).getDay();
    const dayCfg   = providerSettings.businessHours?.[dayIndex];

    // יום סגור שבועי
    if (!dayCfg || !dayCfg.isActive) return [];

    // ✅ יום חופשה ספציפי (closedDays מ-BusinessHoursSettings)
    if (providerSettings.closedDays?.includes(selectedDate)) return [];

    const openMin    = toMin(dayCfg.start);
    const closeMin   = toMin(dayCfg.end);
    const duration   = Number(serviceDuration);
    const slotStep   = 30; // ✅ גרנולריות 30 דקות — ניתן לשינוי עתידי ל-15
    const nowMs      = Date.now();
    const slotsToUse = currentBookedSlots ?? bookedSlots;
    // ✅ currentBookedSlots מהפרמטר קודם לstate — מונע staleness

    const slots = [];

    for (let cur = openMin; cur + duration <= closeMin; cur += slotStep) {
      const slotEnd = cur + duration;

      // ✅ מניעת תורים בעבר — השוואה מדויקת כולל תאריך ושעה
      const slotMs = new Date(`${selectedDate}T${toTimeStr(cur)}:00`).getTime();
      if (slotMs < nowMs) continue;

      // ✅ בדיקת חפיפה מלאה (overlap) מול כל תור קיים
      const hasOverlap = slotsToUse.some((apt) => {
        const aptStart = toMin(apt.startTime);
        const aptEnd   = toMin(apt.endTime);
        // חפיפה: slot מתחיל לפני שהתור נגמר AND slot נגמר אחרי שהתור מתחיל
        return cur < aptEnd && slotEnd > aptStart;
      });

      if (!hasOverlap) slots.push(toTimeStr(cur));
    }

    return slots;
  }, [providerSettings, bookedSlots]);

  // ── 4. שליחת בקשת תור ────────────────────────────────────────
  // ✅ מחזיר את ה-docId לאישור אפשרי בעתיד
  const submitBookingRequest = useCallback(async (bookingData) => {
    if (!providerId) throw new Error('חסר מזהה עסק');
    if (submitting)  throw new Error('כבר בתהליך שליחה'); // ✅ מגן מכפילות

    // ✅ וולידציה client-side לפני קריאה ל-Firestore
    validateBookingPayload(bookingData);

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'bookingRequests'), {
        ...bookingData,
        // ✅ שדות שרק ה-hook קובע — לא הקומפוננט
        ownerUid:  providerId,
        status:    'pending',          // ממתין לאישור הקוסמטיקאית
        createdAt: serverTimestamp(),  // ✅ תמיד serverTimestamp, לא client time
        // ✅ endTime: BookingPage.jsx אחראי לחשב ולהעביר בתוך bookingData
      });

      return docRef.id; // ✅ מוחזר לקומפוננט לאישור / לוג
    } catch (err) {
      console.error('[useBookingPage] submitBookingRequest:', err);
      throw err; // ✅던장 לקומפוננט לטפל ב-UI של שגיאה
    } finally {
      setSubmitting(false);
    }
  }, [providerId, submitting]);

  // ── Return API ────────────────────────────────────────────────
  return {
    // נתוני עסק
    providerSettings,
    services,
    loadingInitial,
    errorInitial,

    // slots
    bookedSlots,
    loadingSlots,
    fetchBookedSlots,          // async (date) => bookedSlots[]
    calculateAvailableSlots,   // (date, duration, bookedSlots?) => timeStr[]

    // שליחה
    submitting,
    submitBookingRequest,      // async (bookingData) => docId
  };
}
