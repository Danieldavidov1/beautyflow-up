// src/hooks/useAutoConfirmWorker.js
import { useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import {
  collection, query, where, onSnapshot,
  updateDoc, getDocs, doc, serverTimestamp, runTransaction, setDoc,
} from 'firebase/firestore';

async function findOrCreateCustomer(uid, guestName, guestPhone) {
  const cleanPhone = guestPhone.replace(/\D/g, '');
  const existing = await getDocs(query(
    collection(db, 'customers'),
    where('userId', '==', uid),
    where('phone',  '==', guestPhone),
  ));
  if (!existing.empty) return { customerId: existing.docs[0].id, isNew: false };

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
    let unsub = () => {};
    let releaseLock;

    // ✅ navigator.locks — סינטקס נכון
    navigator.locks.request(
      `auto_confirm_worker_${uid}`,
      { ifAvailable: true },
      async (lock) => {
        // lock === null אם הנעילה תפוסה (טאב אחר כבר רץ)
        if (!lock) {
          console.log('[AutoConfirm] 🔒 נעילה תפוסה — טאב אחר פעיל');
          return;
        }

        console.log('[AutoConfirm] 🔓 נעילה התקבלה — Worker פעיל');

        return new Promise((resolve) => {
          releaseLock = resolve;

          const q = query(
            collection(db, 'bookingRequests'),
            where('ownerUid', '==', uid),
            where('status',   '==', 'pending'),
          );

          unsub = onSnapshot(q, async (snap) => {
            for (const change of snap.docChanges()) {
              if (change.type !== 'added') continue;

              const reqId  = change.doc.id;
              const reqRef = doc(db, 'bookingRequests', reqId);

              if (processingRef.current.has(reqId)) continue;
              processingRef.current.add(reqId);

              let reqData;
              let slotId;

              try {
                await runTransaction(db, async (t) => {
                  const snapReq = await t.get(reqRef);
                  if (!snapReq.exists() || snapReq.data().status !== 'pending') {
                    throw new Error('not_pending');
                  }
                  reqData = snapReq.data();

                  const cleanTime = reqData.startTime.replace(':', '');
                  slotId = `apt_${uid.substring(0, 5)}_${reqData.date}_${cleanTime}`;
                  const slotRef = doc(db, 'appointments', slotId);

                  const slotSnap = await t.get(slotRef);
                  if (slotSnap.exists()) {
                    t.update(reqRef, { status: 'rejected', rejectReason: 'double_booking', updatedAt: serverTimestamp() });
                    throw new Error('double_booking');
                  }

                  const servicesArray = (reqData.services || []).map((s) => ({
                    ...s,
                    serviceId: s.serviceId || s.id || 'custom',
                    qty:       s.qty       || 1,
                    color:     s.color     || '#e5007e',
                    price:     Number(s.price)    || 0,
                    duration:  Number(s.duration) || 0,
                  }));

                  // ✅ fallback מחושב מתוך services[] כולל qty
                  const fallbackPrice    = servicesArray.reduce((sum, s) => sum + (s.price    * s.qty), 0);
                  const fallbackDuration = servicesArray.reduce((sum, s) => sum + (s.duration * s.qty), 0);

                  t.set(slotRef, {
                    userId:        uid,
                    customerId:    'pending_customer',
                    customerName:  reqData.guestName,
                    customerPhone: reqData.guestPhone,
                    serviceId:     reqData.serviceId    || '',
                    serviceTitle:  reqData.serviceTitle || reqData.title || '',
                    title:         reqData.serviceTitle || reqData.title || '',
                    services:      servicesArray,
                    date:          reqData.date,
                    startTime:     reqData.startTime,
                    endTime:       reqData.endTime      || '',
                    duration:      Number(reqData.serviceDuration) || Number(reqData.duration) || fallbackDuration || 0,
                    price:         Number(reqData.servicePrice)    || Number(reqData.price)    || fallbackPrice    || 0,
                    status:        'scheduled',
                    source:        'online_booking',
                    notes:         reqData.notes        || '',
                    createdAt:     serverTimestamp(),
                  });

                  t.update(reqRef, { status: 'approved', updatedAt: serverTimestamp() });
                });
              } catch (lockErr) {
                if (lockErr.message === 'double_booking') {
                  console.log(`[AutoConfirm] ⚠️ תור נדחה, השעה כבר תפוסה: ${reqId}`);
                }
                processingRef.current.delete(reqId);
                continue;
              }

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
        });
      }
    );

    return () => {
      unsub();
      processingRef.current.clear();
      if (releaseLock) releaseLock();
    };
  }, [autoConfirm]);
}
