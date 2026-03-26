// src/hooks/useAutoConfirmWorker.js
import { useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, getDocs,
  doc, serverTimestamp, runTransaction,
} from 'firebase/firestore';

async function findOrCreateCustomer(uid, guestName, guestPhone) {
  const existing = await getDocs(query(
    collection(db, 'customers'),
    where('userId', '==', uid),
    where('phone',  '==', guestPhone),
  ));
  if (!existing.empty) return { customerId: existing.docs[0].id, isNew: false };
  const newDoc = await addDoc(collection(db, 'customers'), {
    userId:    uid,
    name:      guestName,
    phone:     guestPhone,
    source:    'online_booking',
    createdAt: serverTimestamp(),
  });
  return { customerId: newDoc.id, isNew: true };
}

export function useAutoConfirmWorker(autoConfirm) {
  const processingRef = useRef(new Set());

  useEffect(() => {
    if (!autoConfirm || !auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const q = query(
      collection(db, 'bookingRequests'),
      where('ownerUid', '==', uid),
      where('status',   '==', 'pending'),
    );

    const unsub = onSnapshot(q, async (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== 'added') continue;

        const reqId  = change.doc.id;
        const reqRef = doc(db, 'bookingRequests', reqId);

        // in-memory guard — same tab only
        if (processingRef.current.has(reqId)) continue;
        processingRef.current.add(reqId);

        // ── שלב 1: נעילה אטומית ─────────────────────────────────────
        let reqData;
        try {
          await runTransaction(db, async (t) => {
            const snap = await t.get(reqRef);
            if (!snap.exists()) throw new Error('doc_missing');
            if (snap.data().status !== 'pending') throw new Error('not_pending');
            t.update(reqRef, { status: 'processing', processingAt: serverTimestamp() });
            reqData = snap.data();
          });
        } catch (lockErr) {
          // בקשה כבר נתפסה על ידי טאב אחר — מדלגים
          console.log(`[AutoConfirm] skip ${reqId}:`, lockErr.message);
          processingRef.current.delete(reqId);
          continue;
        }

        // ── שלב 2: עבודה אסינכרונית (מחוץ לטרנזקציה) ────────────────
        try {
          const { customerId } = await findOrCreateCustomer(
            uid, reqData.guestName, reqData.guestPhone,
          );

          await addDoc(collection(db, 'appointments'), {
            userId:        uid,
            customerId,
            customerName:  reqData.guestName,
            customerPhone: reqData.guestPhone,
            serviceId:     reqData.serviceId    || '',
            serviceTitle:  reqData.serviceTitle || reqData.title || '',
            date:          reqData.date,
            startTime:     reqData.startTime,
            endTime:       reqData.endTime      || '',
            duration:      reqData.duration     || 0,
            price:         reqData.price        || 0,
            status:        'scheduled',
            source:        'online_booking',
            notes:         reqData.notes        || '',
            createdAt:     serverTimestamp(),
          });

          await updateDoc(reqRef, {
            status:     'approved',
            customerId,
            updatedAt:  serverTimestamp(),
          });

          console.log(`[AutoConfirm] ✅ אושר: ${reqData.guestName} — ${reqData.date}`);

        } catch (workErr) {
          console.error(`[AutoConfirm] ❌ שגיאה ${reqId}:`, workErr);
          // ── Rollback: החזרה ל-pending כדי שמשתמש יוכל לאשר ידנית
          try {
            await updateDoc(reqRef, { status: 'pending', updatedAt: serverTimestamp() });
          } catch (rbErr) {
            console.error(`[AutoConfirm] rollback failed ${reqId}:`, rbErr);
          }
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
  }, [autoConfirm]);
}