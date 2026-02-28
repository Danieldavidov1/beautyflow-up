// src/components/dashboard/BookingRequests.jsx
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../../firebase';
import {
  collection, query, where, getDocs,
  doc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  Calendar, Clock, User, Phone, Check, X,
  FileText, Inbox, Sparkles, RefreshCw, UserPlus, MessageCircle,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

// ── פונקציית וואטסאפ ─────────────────────────────────────────────────────────
function openWhatsApp(req) {
  const [y, m, d] = req.date.split('-');
  const displayDate = `${d}/${m}/${y}`;
  const service = req.serviceTitle || req.title || '';
  const phone = req.guestPhone.replace(/\D/g, '').replace(/^0/, '972');

  const text = `היי ${req.guestName} מעדכנים אותך! 👋\nשהתור שלך אושר ✅\n📅 תאריך: ${displayDate}\n🕐 שעה: ${req.startTime}\nשירות: ${service}\nנתראה! 😊`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
}

// ── כרטיס בקשה בודד ──────────────────────────────────────────────────────────
function RequestCard({ req, onApprove, onReject, isProcessing }) {
  const [y, m, d] = req.date.split('-');
  const displayDate = `${d}/${m}/${y}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm
                    border border-gray-100 dark:border-gray-700
                    p-5 relative overflow-hidden flex flex-col
                    hover:shadow-md transition-shadow">
      {/* פס עליון */}
      <div className="absolute top-0 left-0 right-0 h-1
                      bg-gradient-to-r from-[#e5007e] to-purple-500" />

      {/* שורת כותרת */}
      <div className="flex justify-between items-start mb-4 mt-1">
        <div>
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-100
                         flex items-center gap-1.5">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            {req.guestName}
          </h3>
          <a href={`tel:${req.guestPhone}`}
             className="text-[#e5007e] text-sm font-medium
                        flex items-center gap-1.5 hover:underline mt-0.5">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {req.guestPhone}
          </a>
        </div>
        <div className="bg-pink-50 dark:bg-pink-900/30 text-[#e5007e]
                        px-2.5 py-1 rounded-lg text-sm font-bold shrink-0">
          ₪{Number(req.price || 0).toLocaleString('he-IL')}
        </div>
      </div>

      {/* פרטי הטיפול */}
      <div className="space-y-2.5 bg-gray-50 dark:bg-gray-700/50
                      p-3 rounded-xl mb-4 text-sm
                      text-gray-600 dark:text-gray-300 flex-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white dark:bg-gray-600
                          flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <span className="font-semibold">{req.serviceTitle || req.title || ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white dark:bg-gray-600
                          flex items-center justify-center shadow-sm shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <span>{displayDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white dark:bg-gray-600
                          flex items-center justify-center shadow-sm shrink-0">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <span>
            {req.startTime} – {req.endTime}
            <span className="text-gray-400 dark:text-gray-500 mr-1">
              ({req.duration || 0} דק׳)
            </span>
          </span>
        </div>
        {req.notes && (
          <div className="flex items-start gap-2 pt-2
                          border-t border-gray-200 dark:border-gray-600">
            <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400 italic">
              "{req.notes}"
            </span>
          </div>
        )}
      </div>

      {/* ✅ כפתור וואטסאפ */}
      <button
        onClick={() => openWhatsApp(req)}
        className="w-full mb-2 flex items-center justify-center gap-2
                   bg-green-500 hover:bg-green-600 active:scale-95
                   text-white py-2.5 rounded-xl font-semibold text-sm
                   transition-all shadow-sm shadow-green-500/20">
        {/* SVG וואטסאפ */}
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.535 5.875L.057 23.25a.75.75 0 0 0 .916.948l5.564-1.457A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.88 0-3.63-.5-5.148-1.367l-.369-.214-3.821 1.001 1.02-3.71-.233-.381A9.945 9.945 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
        שלח אישור בוואטסאפ
      </button>

      {/* כפתורי אישור/דחייה */}
      <div className="flex gap-2">
        <button
          onClick={() => onReject(req.id)}
          disabled={isProcessing}
          className="flex-1 bg-white dark:bg-gray-700
                     border border-red-200 dark:border-red-800
                     text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30
                     py-2.5 rounded-xl font-medium
                     flex items-center justify-center gap-1.5
                     transition-colors disabled:opacity-40">
          <X className="w-4 h-4" /> דחיה
        </button>
        <button
          onClick={() => onApprove(req)}
          disabled={isProcessing}
          className="flex-[2] bg-[#e5007e] hover:bg-[#b30062] text-white
                     py-2.5 rounded-xl font-bold
                     flex items-center justify-center gap-1.5
                     shadow-md shadow-pink-500/20
                     transition-all active:scale-95 disabled:opacity-40">
          {isProcessing ? (
            <span className="w-4 h-4 border-2 border-white
                             border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Check className="w-4 h-4" /> אישור תור</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── BookingRequests ───────────────────────────────────────────────────────────
export default function BookingRequests() {
  const [requests,      setRequests]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const { showToast } = useToast();

  // ── שליפת בקשות ממתינות ──────────────────────────────────────────
  const fetchPendingRequests = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'bookingRequests'),
        where('ownerUid', '==', auth.currentUser.uid),
        where('status',   '==', 'pending'),
      ));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          a.date !== b.date
            ? a.date.localeCompare(b.date)
            : a.startTime.localeCompare(b.startTime)
        );
      setRequests(list);
    } catch (err) {
      console.error('[BookingRequests] fetch:', err);
      showToast('שגיאה בטעינת הבקשות', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchPendingRequests(); }, [fetchPendingRequests]);

  // ── אוטומציית CRM ────────────────────────────────────────────────
  const findOrCreateCustomer = async (req) => {
    const uid = auth.currentUser.uid;
    const existing = await getDocs(query(
      collection(db, 'customers'),
      where('userId', '==', uid),
      where('phone',  '==', req.guestPhone),
    ));
    if (!existing.empty) return { customerId: existing.docs[0].id, isNew: false };
    const newCustomer = await addDoc(collection(db, 'customers'), {
      userId:    uid,
      name:      req.guestName,
      phone:     req.guestPhone,
      source:    'online_booking',
      createdAt: serverTimestamp(),
    });
    return { customerId: newCustomer.id, isNew: true };
  };

  // ── אישור תור ─────────────────────────────────────────────────────
  const handleApprove = async (req) => {
    setActionLoading(req.id);
    try {
      const { customerId, isNew } = await findOrCreateCustomer(req);
      await addDoc(collection(db, 'appointments'), {
        userId:        auth.currentUser.uid,
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
      await updateDoc(doc(db, 'bookingRequests', req.id), {
        status:     'approved',
        customerId,
        updatedAt:  serverTimestamp(),
      });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      showToast(
        isNew
          ? `✅ התור אושר ולקוחה חדשה נוצרה אוטומטית (${req.guestName})!`
          : `✅ התור אושר וקושר ללקוחה הקיימת (${req.guestName})`,
        'success'
      );
    } catch (err) {
      console.error('[BookingRequests] approve:', err);
      showToast('שגיאה באישור התור', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── דחיית תור ─────────────────────────────────────────────────────
  const handleReject = async (reqId) => {
    if (!window.confirm('האם את בטוחה שברצונך לדחות את הבקשה?')) return;
    setActionLoading(reqId);
    try {
      await updateDoc(doc(db, 'bookingRequests', reqId), {
        status:    'rejected',
        updatedAt: serverTimestamp(),
      });
      setRequests((prev) => prev.filter((r) => r.id !== reqId));
      showToast('הבקשה נדחתה והוסרה מהרשימה', 'info');
    } catch (err) {
      console.error('[BookingRequests] reject:', err);
      showToast('שגיאה בדחיית התור', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-10 h-10 border-4 border-[#e5007e]
                      border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100
                         flex items-center gap-2">
            <Inbox className="w-6 h-6 text-[#e5007e]" />
            בקשות ממתינות
            {requests.length > 0 && (
              <span className="bg-[#e5007e] text-white text-xs
                               font-bold px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            )}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            תורים שהתקבלו דרך הלינק הציבורי וממתינים לאישורך
          </p>
        </div>
        <button
          onClick={fetchPendingRequests}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                     hover:bg-gray-50 dark:hover:bg-gray-800
                     text-gray-500 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* legend */}
      {requests.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2
                        bg-purple-50 dark:bg-purple-900/20
                        border border-purple-100 dark:border-purple-800
                        rounded-xl text-xs text-purple-600 dark:text-purple-300">
          <UserPlus className="w-3.5 h-3.5 shrink-0" />
          <span>
            עם אישור תור — לקוחה חדשה תתווסף ל-CRM אוטומטית,
            או תקושר ללקוחה קיימת לפי מספר טלפון.
          </span>
        </div>
      )}

      {/* ✅ הסבר כפתור וואטסאפ */}
      {requests.length > 0 && (
        <div className="flex items-center gap-2 mb-5 px-3 py-2
                        bg-green-50 dark:bg-green-900/20
                        border border-green-200 dark:border-green-800
                        rounded-xl text-xs text-green-700 dark:text-green-300">
          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            לחצי על <strong>שלח אישור בוואטסאפ</strong> כדי לפתוח שיחה עם הטקסט המוכן ללקוחה — לפני או אחרי האישור.
          </span>
        </div>
      )}

      {/* Empty state */}
      {requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm
                        border border-gray-100 dark:border-gray-700
                        p-12 text-center">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20
                          rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">
            אין בקשות ממתינות
          </h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            כל הבקשות טופלו! תורים חדשים יופיעו כאן אוטומטית.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onApprove={handleApprove}
              onReject={handleReject}
              isProcessing={actionLoading === req.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
