// src/components/dashboard/CustomerProfile.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useTreatments } from '../../hooks/useTreatments';
import { useToast } from '../../context/ToastContext';
import {
  ArrowRight, Phone, MessageCircle, Calendar,
  Plus, Trash2, AlertCircle, Tag, X, Edit,
  Globe, Smartphone, TrendingUp, ShoppingBag, Clock, FileText,
  MessageSquare
} from 'lucide-react';
import gsap from 'gsap';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('he-IL');
}

function sanitizePhone(raw = '') {
  let num = raw.replace(/[\s\-().]/g, '');
  if (num.startsWith('0'))  num = '972' + num.slice(1);
  if (num.startsWith('+'))  num = num.slice(1);
  return num;
}

const CUSTOMER_TYPE_LABELS = {
  vip:     { label: 'VIP',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  new:     { label: 'חדשה',  cls: 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400'  },
  regular: { label: 'רגילה', cls: 'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-400'   },
};

const STATUS_STYLES = {
  scheduled: { label: 'מתוכנן',  cls: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400'   },
  completed:  { label: 'הושלם',  cls: 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400'  },
  cancelled:  { label: 'בוטל',   cls: 'bg-red-100    text-red-600    dark:bg-red-900/30    dark:text-red-400'    },
  pending:    { label: 'ממתין',  cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

// ✅ EMPTY_TREATMENT ללא price, עם id אופציונלי לצורך עריכה
const EMPTY_TREATMENT = {
  title: '', date: new Date().toISOString().split('T')[0], notes: '',
};

// ── Hook: useCustomerAppointments ──────────────────────────────────────────
function useCustomerAppointments(customerId) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) { setAppointments([]); setLoading(false); return; }

    const q = query(
      collection(db, 'appointments'),
      where('customerId', '==', customerId),
      orderBy('date', 'desc'),
      orderBy('startTime', 'desc')
    );

    const unsub = onSnapshot(q,
      (snap) => {
        setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useCustomerAppointments] error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [customerId]);

  return { appointments, loading };
}

// ── DeleteTreatmentModal ───────────────────────────────────────────────────
function DeleteTreatmentModal({ isOpen, treatmentTitle, onConfirm, onCancel }) {
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)' }
    );
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
        dir="rtl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30
                          flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">מחיקת הערה</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              למחוק את ההערה{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                &quot;{treatmentTitle}&quot;
              </span>?
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                       text-sm font-medium text-gray-600 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            ביטול
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                       text-white text-sm font-semibold transition-colors">
            מחק
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent = false }) {
  return (
    <div className={`text-center p-3 rounded-xl ${
      accent
        ? 'bg-pink-50 dark:bg-pink-900/10'
        : 'bg-gray-50 dark:bg-gray-700/50'
    }`}>
      <Icon className={`w-4 h-4 mx-auto mb-1 ${accent ? 'text-[#e5007e]' : 'text-gray-400'}`} />
      <p className={`text-lg font-bold ${accent ? 'text-[#e5007e]' : 'text-gray-700 dark:text-gray-300'}`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// ── CustomerProfile ────────────────────────────────────────────────────────
export default function CustomerProfile({ customer, onBack, onEdit }) {
  // ✅ 3. הוספת updateTreatment מה-hook
  const { treatments, loading: loadingTreatments, error, addTreatment, updateTreatment, deleteTreatment } =
    useTreatments(customer?.id);
  const { appointments, loading: loadingAppts } =
    useCustomerAppointments(customer?.id);
  const { showToast } = useToast();

  const [isAdding,          setIsAdding]          = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [newTreatment,      setNewTreatment]      = useState(EMPTY_TREATMENT);
  const [deletingTreatment, setDeletingTreatment] = useState(null);
  // ✅ 3. האם אנחנו במצב עריכה (יש id)
  const isEditingNote = !!newTreatment.id;

  const pageRef     = useRef(null);
  const formRef     = useRef(null);
  const timelineRef = useRef(null);

  // ── חישוב סטטיסטיקות ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const treatmentsRevenue = treatments.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    const apptRevenue       = appointments
      .filter((a) => a.status === 'completed')
      .reduce((sum, a) => sum + (Number(a.price) || 0), 0);

    const totalRevenue   = treatmentsRevenue + apptRevenue;
    const completedAppts = appointments.filter((a) => a.status === 'completed').length;
    const totalVisits    = (customer.totalVisits ?? 0) + completedAppts;

    return { totalRevenue, completedAppts, totalVisits };
  }, [treatments, appointments, customer.totalVisits]);

  // ✅ Unified Timeline — מיזוג וממוין לפי תאריך יורד
  const unifiedTimeline = useMemo(() => {
    const taggedTreatments   = treatments.map((t) => ({ ...t, _type: 'note'        }));
    const taggedAppointments = appointments.map((a) => ({ ...a, _type: 'appointment' }));

    return [...taggedTreatments, ...taggedAppointments].sort((a, b) => {
      const dateDiff = (b.date || '').localeCompare(a.date || '');
      if (dateDiff !== 0) return dateDiff;
      return ((b.startTime || '') > (a.startTime || '')) ? 1 : -1;
    });
  }, [treatments, appointments]);

  // ── GSAP ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pageRef.current) return;
    gsap.fromTo(pageRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  }, []);

  useEffect(() => {
    if (loadingTreatments || loadingAppts || !timelineRef.current) return;
    const items = timelineRef.current.querySelectorAll('.timeline-item');
    if (items.length === 0) return;
    gsap.fromTo(items,
      { opacity: 0, x: -16 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' }
    );
  }, [loadingTreatments, loadingAppts, unifiedTimeline]);

  useEffect(() => {
    if (!isAdding || !formRef.current) return;
    gsap.fromTo(formRef.current,
      { opacity: 0, height: 0 },
      { opacity: 1, height: 'auto', duration: 0.3, ease: 'power2.out' }
    );
  }, [isAdding]);

  if (!customer) return null;

  const typeMeta  = CUSTOMER_TYPE_LABELS[customer.customerType] ?? CUSTOMER_TYPE_LABELS.regular;
  const isFromWeb = customer.source === 'online_booking';
  const set       = (field) => (e) => setNewTreatment((p) => ({ ...p, [field]: e.target.value }));

  // ✅ 3. פתיחת הטופס לעריכת הערה קיימת
  const handleEditNote = (note) => {
    setNewTreatment({ id: note.id, title: note.title, date: note.date, notes: note.notes || '' });
    setIsAdding(true);
  };

  // ✅ 3. handleAddTreatment — קורא ל-updateTreatment אם יש id, אחרת addTreatment
  const handleAddTreatment = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (isEditingNote) {
        // עריכת הערה קיימת
        const { id, ...updateData } = newTreatment;
        await updateTreatment(id, updateData);
        showToast('הערה עודכנה בהצלחה ✓', 'success');
      } else {
        // הוספת הערה חדשה
        await addTreatment(newTreatment);
        showToast('הערה נוספה בהצלחה ✓', 'success');
      }
      setIsAdding(false);
      setNewTreatment(EMPTY_TREATMENT);
    } catch {
      showToast(isEditingNote ? 'שגיאה בעדכון הערה' : 'שגיאה בהוספת הערה', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTreatment) return;
    try {
      await deleteTreatment(deletingTreatment.id);
      showToast('ההערה נמחקה', 'success');
    } catch {
      showToast('שגיאה במחיקה', 'error');
    } finally {
      setDeletingTreatment(null);
    }
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setNewTreatment(EMPTY_TREATMENT);
  };

  const inputCls = `w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-800 dark:text-white text-sm outline-none
    focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all`;

  const loading = loadingTreatments || loadingAppts;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div ref={pageRef} className="space-y-6 p-4 md:p-8" dir="rtl">

      <DeleteTreatmentModal
        isOpen={!!deletingTreatment}
        treatmentTitle={deletingTreatment?.title}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTreatment(null)}
      />

      {/* חזרה */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-[#e5007e]
                   transition-colors font-medium text-sm">
        <ArrowRight className="w-4 h-4" />
        חזרה לרשימת הלקוחות
      </button>

      <div className="flex flex-col md:flex-row gap-6">

        {/* ── עמודה שמאל: פרופיל ──────────────────────────────────────── */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm
                          border border-gray-100 dark:border-gray-700">

            {/* Avatar + שם + מקור */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-gray-700
                              flex items-center justify-center text-2xl font-bold
                              text-[#e5007e] shrink-0">
                {customer.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {customer.name}
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${typeMeta.cls}`}>
                    {typeMeta.label}
                  </span>
                  {isFromWeb ? (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5
                                     rounded-full font-semibold
                                     bg-blue-100 text-blue-700
                                     dark:bg-blue-900/30 dark:text-blue-400">
                      <Globe className="w-2.5 h-2.5" />
                      זימון תורים
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5
                                     rounded-full font-semibold
                                     bg-gray-100 text-gray-500
                                     dark:bg-gray-700 dark:text-gray-400">
                      <Smartphone className="w-2.5 h-2.5" />
                      ידני
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* פרטי קשר */}
            <div className="space-y-2 mb-5 text-sm text-gray-600 dark:text-gray-400">
              <p className="flex items-center gap-2" dir="ltr">
                <Phone className="w-4 h-4 text-[#e5007e] shrink-0" />
                {customer.phone}
              </p>
              {customer.email && (
                <p className="flex items-center gap-2 truncate">
                  <span className="text-[#e5007e]">@</span>
                  {customer.email}
                </p>
              )}
              {customer.birthdate && (
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#e5007e] shrink-0" />
                  {formatDate(customer.birthdate)}
                </p>
              )}
            </div>

            {/* כפתורי פעולה */}
            <div className="flex flex-col xl:flex-row gap-2">
              <button
                onClick={() => window.open(`https://wa.me/${sanitizePhone(customer.phone)}`, '_blank')}
                className="flex-1 flex items-center justify-center gap-2 py-2
                           bg-[#25D366] hover:bg-[#128C7E] text-white
                           rounded-xl transition-colors text-sm font-medium">
                <MessageCircle className="w-4 h-4" /> וואטסאפ
              </button>
              <div className="flex flex-1 gap-2">
                <a href={`tel:${customer.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2
                             bg-gray-100 hover:bg-gray-200 dark:bg-gray-700
                             dark:hover:bg-gray-600 text-gray-700 dark:text-white
                             rounded-xl transition-colors text-sm font-medium">
                  <Phone className="w-4 h-4" /> חיוג
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit?.(customer); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2
                             bg-gray-100 hover:bg-gray-200 dark:bg-gray-700
                             dark:hover:bg-gray-600 text-gray-700 dark:text-white
                             rounded-xl transition-colors text-sm font-medium">
                  <Edit className="w-4 h-4" /> עריכה
                </button>
              </div>
            </div>

            {/* תגיות */}
            {(customer.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4
                              border-t border-gray-100 dark:border-gray-700">
                {customer.tags.map((tag) => (
                  <span key={tag}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5
                               rounded-full bg-gray-100 text-gray-600
                               dark:bg-gray-700 dark:text-gray-300">
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* סטטיסטיקות מחושבות */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4
                            border-t border-gray-100 dark:border-gray-700">
              <StatCard
                icon={Calendar}
                label="ביקורים"
                value={stats.totalVisits}
                accent
              />
              <StatCard
                icon={ShoppingBag}
                label="תורים"
                value={appointments.length}
              />
              <StatCard
                icon={TrendingUp}
                label="הכנסה"
                value={stats.totalRevenue > 0 ? `₪${stats.totalRevenue.toLocaleString()}` : '—'}
                accent={stats.totalRevenue > 0}
              />
            </div>

            {/* מידע רפואי */}
            {(customer.medicalNotes || customer.allergies) && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl
                              border border-red-100 dark:border-red-800/50">
                <h3 className="text-sm font-bold text-red-700 dark:text-red-400
                               flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4" /> מידע רפואי חשוב
                </h3>
                {customer.medicalNotes && (
                  <p className="text-xs text-red-600 dark:text-red-300 mb-1">
                    <strong>הערות:</strong> {customer.medicalNotes}
                  </p>
                )}
                {customer.allergies && (
                  <p className="text-xs text-red-600 dark:text-red-300">
                    <strong>רגישויות:</strong> {customer.allergies}
                  </p>
                )}
              </div>
            )}

            {/* הערות כלליות */}
            {customer.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  הערות כלליות
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {customer.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── עמודה ימין: Unified Timeline ─────────────────────────── */}
        <div className="w-full md:w-2/3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm
                          border border-gray-100 dark:border-gray-700 min-h-[500px]">

            {/* כותרת + כפתור הוספה */}
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
                  היסטוריה מלאה
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  תורים והערות ידניות — ממוינים לפי תאריך
                </p>
              </div>

              {!isAdding && (
                <button onClick={() => { setNewTreatment(EMPTY_TREATMENT); setIsAdding(true); }}
                  className="flex items-center gap-1.5 text-sm font-semibold
                             text-[#e5007e] hover:text-[#b30062] bg-pink-50
                             dark:bg-pink-900/30 dark:hover:bg-pink-900/50
                             px-3 py-1.5 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> הוסף הערה ידנית
                </button>
              )}
            </div>

            {/* ✅ 3. טופס הוספה / עריכת הערה ידנית */}
            {isAdding && (
              <div ref={formRef} className="overflow-hidden">
                <form onSubmit={handleAddTreatment}
                  className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-6
                             border border-gray-100 dark:border-gray-600 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">
                      {/* ✅ כותרת דינמית לפי מצב עריכה/הוספה */}
                      {isEditingNote ? '✏️ עריכת הערה' : 'הוספת הערה ידנית'}
                    </h3>
                    <button type="button" onClick={handleCancelForm}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" required placeholder="כותרת ההערה"
                      value={newTreatment.title} onChange={set('title')} className={inputCls} />
                    <input type="date" required
                      value={newTreatment.date} onChange={set('date')} className={inputCls} />
                  </div>
                  <textarea placeholder="תוכן ההערה (חומרים, תגובה, דגשים לפעם הבאה...)"
                    rows={3} value={newTreatment.notes} onChange={set('notes')}
                    className={`${inputCls} resize-none`} />

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={handleCancelForm}
                      className="px-4 py-2 text-sm font-medium text-gray-500
                                 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">
                      ביטול
                    </button>
                    <button type="submit" disabled={saving}
                      className="px-4 py-2 text-sm font-bold text-white bg-[#e5007e]
                                 hover:bg-[#b30062] rounded-lg disabled:opacity-50">
                      {/* ✅ טקסט כפתור דינמי */}
                      {saving ? 'שומר...' : isEditingNote ? 'שמור שינויים' : 'שמור הערה'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Unified Timeline */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-4 border-[#e5007e] border-t-transparent
                                rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-20 text-red-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                שגיאה בטעינת הנתונים
              </div>
            ) : unifiedTimeline.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium mb-1">אין עדיין היסטוריה ללקוחה זו.</p>
                <button onClick={() => { setNewTreatment(EMPTY_TREATMENT); setIsAdding(true); }}
                  className="text-[#e5007e] hover:underline text-sm font-medium mt-1">
                  + הוסף הערה ידנית ראשונה
                </button>
              </div>
            ) : (
              <div ref={timelineRef} className="space-y-4">
                {unifiedTimeline.map((item) => (
                  item._type === 'appointment'
                    ? /* ── כרטיס תור ──────────────────────────────────────── */
                      <div key={item.id} className="timeline-item flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30
                                          flex items-center justify-center shrink-0
                                          border border-blue-100 dark:border-blue-800">
                            <Calendar className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-700 my-2" />
                        </div>
                        <div className="flex-1 bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4
                                        border border-gray-100 dark:border-gray-700 mb-2
                                        hover:shadow-sm transition-shadow">
                          {/* כותרת + סטטוס */}
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                                {item.serviceTitle || item.title || 'טיפול ללא שם'}
                              </h3>
                              <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                <span>{formatDate(item.date)}</span>
                                <span>•</span>
                                <Clock className="w-3 h-3" />
                                <span>{item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}</span>
                              </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              (STATUS_STYLES[item.status] || STATUS_STYLES.pending).cls
                            }`}>
                              {(STATUS_STYLES[item.status] || STATUS_STYLES.pending).label}
                            </span>
                          </div>

                          {/* מחיר */}
                          {item.price > 0 && (
                            <p className="text-xs font-bold text-[#e5007e] mt-2
                                          bg-pink-50 dark:bg-pink-900/20
                                          inline-block px-2 py-1 rounded-md">
                              מחיר שנקבע: ₪{item.price}
                            </p>
                          )}

                          {/* מקור אונליין */}
                          {item.source === 'online_booking' && (
                            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                              <Globe className="w-3 h-3" /> תור זה נקבע אונליין מהאתר
                            </p>
                          )}

                          {/* הערות התור */}
                          {item.notes && (
                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20
                                            rounded-xl border border-blue-100 dark:border-blue-800/50
                                            flex items-start gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-blue-700 dark:text-blue-300
                                            leading-relaxed whitespace-pre-wrap">
                                {item.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                    : /* ── כרטיס הערה ידנית ────────────────────────────────── */
                      <div key={item.id} className="timeline-item flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-pink-50 dark:bg-pink-900/30
                                          flex items-center justify-center shrink-0
                                          border border-pink-100 dark:border-pink-800">
                            <FileText className="w-4 h-4 text-[#e5007e]" />
                          </div>
                          <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-700 my-2" />
                        </div>
                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl p-4
                                        border border-gray-100 dark:border-gray-700 mb-2
                                        hover:shadow-sm transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                                {item.title}
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                הערה ידנית · {formatDate(item.date)}
                              </p>
                            </div>
                            {/* ✅ 3. כפתורי Edit + Trash2 לצד הערות ידניות */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditNote(item)}
                                title="ערוך הערה"
                                className="text-gray-400 hover:text-[#e5007e] transition-colors p-1">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingTreatment(item)}
                                title="מחק הערה"
                                className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {item.notes && (
                            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                              <p className="text-sm text-gray-600 dark:text-gray-300
                                            leading-relaxed whitespace-pre-wrap">
                                {item.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}