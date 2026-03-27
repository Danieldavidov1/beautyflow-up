// src/hooks/useAutoConfirmWorker.js
import { useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import {
  collection, query, where, onSnapshot,
  updateDoc, getDocs,
  doc, serverTimestamp, runTransaction, setDoc,
} from 'firebase/firestore';

async function findOrCreateCustomer(uid, guestName, guestPhone) {
  const cleanPhone = guestPhone.replace(/\D/g, '');

  const existing = await getDocs(query(
    collection(db, 'customers'),
    where('userId', '==', uid),
    where('phone',  '==', guestPhone),
  ));
  if (!existing.empty) return { customerId: existing.docs[0].id, isNew: false };

  // מזהה קבוע לפי מספר טלפון (מונע כפל לקוחות לחלוטין)
  const newCustId   = `cust_${uid.substring(0, 5)}_${cleanPhone}`;
  const customerRef = doc(db, 'customers', newCustId);

  await setDoc(customerRef, {
    userId:    uid,
    name:      guestName,
    phone:     guestPhone,
    source:    'online_booking',
    createdAt: serverTimestamp(),
  }, { merge: true });

  return { customerId: newCustId, isNew: true };
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

        if (processingRef.current.has(reqId)) continue;
        processingRef.current.add(reqId);

        let reqData;
        let slotId;
        
        // ── שלב 1: נעילה אטומית ישירות ביומן (בלי סטטוס processing!) ──
        try {
          await runTransaction(db, async (t) => {
            const snapReq = await t.get(reqRef);
            if (!snapReq.exists() || snapReq.data().status !== 'pending') {
              throw new Error('not_pending');
            }
            reqData = snapReq.data();
            
            // מזהה קבוע לפי השעה המבוקשת (מונע כפל תורים!)
            const cleanTime = reqData.startTime.replace(':', '');
            slotId = `apt_${uid.substring(0, 5)}_${reqData.date}_${cleanTime}`;
            const slotRef = doc(db, 'appointments', slotId);
            
            const slotSnap = await t.get(slotRef);
            if (slotSnap.exists()) {
              t.update(reqRef, { status: 'rejected', rejectReason: 'double_booking', updatedAt: serverTimestamp() });
              throw new Error('double_booking');
            }

            // יצירת התור מיד בטרנזקציה (הלקוח יתעדכן בשלב הבא)
            t.set(slotRef, {
              userId:        uid,
              customerId:    'pending_customer',
              customerName:  reqData.guestName,
              customerPhone: reqData.guestPhone,
              serviceId:     reqData.serviceId    || '',
              serviceTitle:  reqData.serviceTitle || reqData.title || '',
              title:         reqData.serviceTitle || reqData.title || '',
              services: (reqData.services || []).map((s) => ({
                ...s, qty: s.qty || 1, color: s.color || '#e5007e',
              })),
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

            // עדכון הסטטוס לאושר (חוקי לחלוטין בפיירבייס)
            t.update(reqRef, { status: 'approved', updatedAt: serverTimestamp() });
          });
        } catch (lockErr) {
          if (lockErr.message === 'double_booking') {
            console.log(`[AutoConfirm] ⚠️ תור נדחה, השעה כבר תפוסה: ${reqId}`);
          }
          processingRef.current.delete(reqId);
          continue;
        }

        // ── שלב 2: שיוך לקוח אמיתי ─────────────────────────────────
        try {
          const { customerId } = await findOrCreateCustomer(
            uid, reqData.guestName, reqData.guestPhone,
          );
          
          await updateDoc(doc(db, 'appointments', slotId), { customerId });
          await updateDoc(reqRef, { customerId });

          console.log(`[AutoConfirm] ✅ אושר: ${reqData.guestName} — ${reqData.date}`);

        } catch (workErr) {
          console.error(`[AutoConfirm] ❌ שגיאה בשיוך לקוח ${reqId}:`, workErr);
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