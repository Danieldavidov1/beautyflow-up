// src/hooks/useBusinessSettings.js
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

// ── ברירות מחדל ────────────────────────────────────────────────────────────
// 0 = ראשון ... 6 = שבת
export const DEFAULT_BUSINESS_HOURS = {
  0: { isActive: true,  start: '09:00', end: '19:00' }, // ראשון
  1: { isActive: true,  start: '09:00', end: '19:00' }, // שני
  2: { isActive: true,  start: '09:00', end: '19:00' }, // שלישי
  3: { isActive: true,  start: '09:00', end: '19:00' }, // רביעי
  4: { isActive: true,  start: '09:00', end: '19:00' }, // חמישי
  5: { isActive: true,  start: '09:00', end: '14:00' }, // שישי — חצי יום
  6: { isActive: false, start: '09:00', end: '18:00' }, // שבת — סגור
};

export const DEFAULT_SETTINGS = {
  businessHours: DEFAULT_BUSINESS_HOURS,
  businessName:  '',        // ✅ לדף בוקינג חיצוני עתידי
  businessPhone: '',        // ✅ לדף בוקינג חיצוני עתידי
  closedDays:    [],        // ✅ מערך של 'YYYY-MM-DD' לחגים/חופשות
  slotDuration:  30,        // ✅ משך ברירת מחדל לתור (דקות) — לבוקינג עתידי
};

// ── Helper: האם שעה מסוימת בתוך שעות העסק ─────────────────────────────────
// מחזיר true אם התור מותר, false אם לא (משמש ב-Calendar.jsx)
export function checkAppointmentAllowed(businessHours, closedDays = [], date, startTime, endTime) {
  if (!date || !startTime || !endTime) return true; // אם חסר מידע — מאפשר

  // בדיקת יום חופשה ספציפי
  if (closedDays.includes(date)) return false;

  const dayIndex = new Date(date + 'T12:00:00').getDay(); // T12 מונע בעיות timezone
  const dayConfig = businessHours?.[dayIndex];

  if (!dayConfig || !dayConfig.isActive) return false; // יום סגור

  // המרת string שעה למספר דקות לצורך השוואה
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  return toMin(startTime) >= toMin(dayConfig.start)
      && toMin(endTime)   <= toMin(dayConfig.end);
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useBusinessSettings() {
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    let unsubscribeSnapshot = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeSnapshot(); // נקה listener קודם

      if (!user) {
        setSettings(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const docRef = doc(db, 'userSettings', user.uid);

      unsubscribeSnapshot = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSettings({
              ...DEFAULT_SETTINGS,
              ...data,
              // מיזוג חכם של businessHours — שומר ברירות מחדל לימים חסרים
              businessHours: data.businessHours
                ? { ...DEFAULT_BUSINESS_HOURS, ...data.businessHours }
                : DEFAULT_BUSINESS_HOURS,
            });
          } else {
            // משתמש חדש — אין מסמך עדיין, נשתמש בברירות מחדל
            setSettings(DEFAULT_SETTINGS);
          }
          setLoading(false);
        },
        (err) => {
          console.error('[useBusinessSettings] snapshot error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, []);

  // ── עדכון שעות פעילות ─────────────────────────────────────────────────────
  // merge: true — לא מוחק נתונים אחרים ב-userSettings (קטגוריות תבניות וכו')
  const updateBusinessHours = useCallback(async (newHours) => {
    const user = auth.currentUser;
    if (!user) throw new Error('לא מחובר');

    const docRef = doc(db, 'userSettings', user.uid);
    try {
      await setDoc(docRef, { businessHours: newHours }, { merge: true });
    } catch (err) {
      console.error('[useBusinessSettings] updateBusinessHours error:', err);
      throw err;
    }
  }, []);

  // ── עדכון הגדרות כלליות (שם עסק, טלפון, slotDuration וכו') ──────────────
  const updateGeneralSettings = useCallback(async (newData) => {
    const user = auth.currentUser;
    if (!user) throw new Error('לא מחובר');

    const docRef = doc(db, 'userSettings', user.uid);
    try {
      await setDoc(docRef, newData, { merge: true });
    } catch (err) {
      console.error('[useBusinessSettings] updateGeneralSettings error:', err);
      throw err;
    }
  }, []);

  // ── הוספה/הסרה של יום חופשה ──────────────────────────────────────────────
  // dateStr = 'YYYY-MM-DD'
  const toggleClosedDay = useCallback(async (dateStr) => {
    const user = auth.currentUser;
    if (!user) throw new Error('לא מחובר');

    const current = settings?.closedDays ?? [];
    const updated = current.includes(dateStr)
      ? current.filter((d) => d !== dateStr)   // הסר
      : [...current, dateStr];                 // הוסף

    const docRef = doc(db, 'userSettings', user.uid);
    try {
      await setDoc(docRef, { closedDays: updated }, { merge: true });
    } catch (err) {
      console.error('[useBusinessSettings] toggleClosedDay error:', err);
      throw err;
    }
  }, [settings]);

  // ── isAppointmentAllowed — עוטף את checkAppointmentAllowed עם הנתונים הנוכחיים
  const isAppointmentAllowed = useCallback((date, startTime, endTime) => {
    return checkAppointmentAllowed(
      settings?.businessHours ?? DEFAULT_BUSINESS_HOURS,
      settings?.closedDays    ?? [],
      date, startTime, endTime
    );
  }, [settings]);

  return {
    settings,
    loading,
    error,
    // שדות נוחות
    businessHours: settings?.businessHours ?? DEFAULT_BUSINESS_HOURS,
    businessName:  settings?.businessName  ?? '',
    businessPhone: settings?.businessPhone ?? '',
    closedDays:    settings?.closedDays    ?? [],
    slotDuration:  settings?.slotDuration  ?? 30,
    // פונקציות
    updateBusinessHours,
    updateGeneralSettings,
    toggleClosedDay,
    isAppointmentAllowed, // ✅ ישתמש ב-Calendar.jsx להתראה על תור מחוץ לשעות
  };
}
