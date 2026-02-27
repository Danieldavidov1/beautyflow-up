// src/hooks/useAutoConfirmWorker.js
// ─────────────────────────────────────────────────────────────────────────────
// Background Worker — רץ בתוך מערכת הניהול כשהקוסמטיקאית מחוברת
// כשהמתג "אישור אוטומטי" דלוק — האזנה ל-bookingRequests ועיבוד ידני
// ✅ מאובטח: כל הכתיבה ל-appointments/customers ע"י משתמש מחובר (isOwner)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, getDocs,
  doc, serverTimestamp,
} from 'firebase/firestore';

// ── מצא או צור לקוחה (זהה ל-BookingRequests.jsx) ────────────────────────────
async function findOrCreateCustomer(uid, guestName, guestPhone) {
  const existing = await getDocs(query(
    collection(db, 'customers'),
    where('userId', '==', uid),
    where('phone',  '==', guestPhone),
  ));

  if (!existing.empty) {
    return { customerId: existing.docs[0].id, isNew: false };
  }

  const newDoc = await addDoc(collection(db, 'customers'), {
    userId:    uid,
    name:      guestName,
    phone:     guestPhone,
    source:    'online_booking',
    createdAt: serverTimestamp(),
  });

  return { customerId: newDoc.id, isNew: true };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAutoConfirmWorker(autoConfirm) {
  // ✅ ref לרשימת בקשות שכבר בעיבוד — מונע עיבוד כפול
  const processingRef = useRef(new Set());

  useEffect(() => {
    // לא רץ אם: המתג כבוי, המשתמש לא מחובר
    if (!autoConfirm || !auth.currentUser) return;

    const uid = auth.currentUser.uid;

    const q = query(
      collection(db, 'bookingRequests'),
      where('ownerUid', '==', uid),
      where('status',   '==', 'pending'),
    );

    // ✅ onSnapshot — כל בקשה חדשה מטופלת מיד
    const unsub = onSnapshot(q, async (snap) => {
      for (const change of snap.docChanges()) {
        // רק בקשות חדשות שנכנסו — לא שינויים
        if (change.type !== 'added') continue;

        const reqId = change.doc.id;
        const req   = change.doc.data();

        // ✅ מונע עיבוד כפול אם snapshot מגיע שוב
        if (processingRef.current.has(reqId)) continue;
        processingRef.current.add(reqId);

        try {
          // א. מצא או צור לקוחה
          const { customerId } = await findOrCreateCustomer(
            uid,
            req.guestName,
            req.guestPhone,
          );

          // ב. כתוב ל-appointments (כמחובר — isOwner יעבור)
          await addDoc(collection(db, 'appointments'), {
            userId:        uid,
            customerId,
            customerName:  req.guestName,
            customerPhone: req.guestPhone,
            serviceId:     req.serviceId    || '',
            serviceTitle:  req.serviceTitle || req.title || '',
            date:          req.date,
            startTime:     req.startTime,
            endTime:       req.endTime      || '',
            duration:      req.duration     || 0,
            price:         req.price        || 0,
            status:        'scheduled',
            source:        'online_booking',
            notes:         req.notes        || '',
            createdAt:     serverTimestamp(),
          });

          // ג. עדכן סטטוס הבקשה ל-approved
          await updateDoc(doc(db, 'bookingRequests', reqId), {
            status:     'approved',
            customerId,
            updatedAt:  serverTimestamp(),
          });

          console.log(`[AutoConfirm] ✅ אושר אוטומטית: ${req.guestName} — ${req.date}`);

        } catch (err) {
          console.error(`[AutoConfirm] ❌ שגיאה בעיבוד ${reqId}:`, err);
          // ✅ הסר מהעיבוד כדי שינסה שוב בפעם הבאה
          processingRef.current.delete(reqId);
        }
      }
    }, (err) => {
      console.error('[AutoConfirm] onSnapshot error:', err);
    });

    return () => {
      unsub();
      processingRef.current.clear();
    };
  }, [autoConfirm]); // ✅ מופעל מחדש רק כשהמתג משתנה
}
