// src/components/dashboard/CustomerProfile.jsx
import { useState, useEffect, useRef } from 'react';
import { useTreatments } from '../../hooks/useTreatments';
import { useToast } from '../../context/ToastContext';
import {
  ArrowRight, Phone, MessageCircle, Calendar,
  Plus, Trash2, AlertCircle, Tag, User, X, Edit
} from 'lucide-react';
import gsap from 'gsap'; // ✅ GSAP כמו שאר הפרויקט

// ── Helpers ────────────────────────────────────────────────────────────────

// ✅ תיקון timezone — מונע היסט של יום אחד
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

const EMPTY_TREATMENT = {
  title: '', date: new Date().toISOString().split('T')[0], price: '', notes: '',
};

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
            <h3 className="font-bold text-gray-800 dark:text-gray-100">מחיקת טיפול</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              למחוק את הטיפול{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                "{treatmentTitle}"
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

// ── CustomerProfile ────────────────────────────────────────────────────────

// ✅ הוספנו את onEdit לכאן
export default function CustomerProfile({ customer, onBack, onEdit }) {
  const { treatments, loading, error, addTreatment, deleteTreatment } =
    useTreatments(customer?.id);
  const { showToast } = useToast();

  const [isAdding,          setIsAdding]          = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [newTreatment,      setNewTreatment]      = useState(EMPTY_TREATMENT);
  const [deletingTreatment, setDeletingTreatment] = useState(null);

  const pageRef     = useRef(null);
  const formRef     = useRef(null);
  const timelineRef = useRef(null);

  // GSAP — כניסת עמוד
  useEffect(() => {
    if (!pageRef.current) return;
    gsap.fromTo(pageRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  }, []);

  // GSAP — אנימציית טיפולים בטעינה
  useEffect(() => {
    if (loading || !timelineRef.current) return;
    const items = timelineRef.current.querySelectorAll('.timeline-item');
    if (items.length === 0) return;
    gsap.fromTo(items,
      { opacity: 0, x: -16 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.06, ease: 'power2.out' }
    );
  }, [loading, treatments.length]);

  // GSAP — פתיחת טופס הוספה
  useEffect(() => {
    if (!isAdding || !formRef.current) return;
    gsap.fromTo(formRef.current,
      { opacity: 0, height: 0 },
      { opacity: 1, height: 'auto', duration: 0.3, ease: 'power2.out' }
    );
  }, [isAdding]);

  if (!customer) return null;

  const typeMeta = CUSTOMER_TYPE_LABELS[customer.customerType] ?? CUSTOMER_TYPE_LABELS.regular;

  const set = (field) => (e) =>
    setNewTreatment((p) => ({ ...p, [field]: e.target.value }));

  const handleAddTreatment = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await addTreatment(newTreatment);
      showToast('טיפול נוסף בהצלחה ✓', 'success');
      setIsAdding(false);
      setNewTreatment(EMPTY_TREATMENT);
    } catch {
      showToast('שגיאה בהוספת טיפול', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTreatment) return;
    try {
      await deleteTreatment(deletingTreatment.id);
      showToast('הטיפול נמחק', 'success');
    } catch {
      showToast('שגיאה במחיקה', 'error');
    } finally {
      setDeletingTreatment(null);
    }
  };

  const inputCls = `w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-800 dark:text-white text-sm outline-none
    focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all`;

  return (
    <div ref={pageRef} className="space-y-6 p-4 md:p-8" dir="rtl">

      {/* חזרה */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-gray-500 hover:text-[#e5007e]
                   transition-colors font-medium text-sm">
        <ArrowRight className="w-4 h-4" />
        חזרה לרשימת הלקוחות
      </button>

      <div className="flex flex-col md:flex-row gap-6">

        {/* ── עמודה שמאל: פרופיל ───────────────────────────────────────── */}
        <div className="w-full md:w-1/3 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm
                          border border-gray-100 dark:border-gray-700">

            {/* Avatar + שם */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-gray-700
                              flex items-center justify-center text-2xl font-bold
                              text-[#e5007e] shrink-0">
                {customer.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {customer.name}
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${typeMeta.cls}`}>
                  {typeMeta.label}
                </span>
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
                onClick={() => window.open(
                  `https://wa.me/${sanitizePhone(customer.phone)}`, '_blank'
                )}
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
                {/* ✅ כפתור עריכה שהוספנו כאן */}
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

            {/* סטטיסטיקה */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4
                            border-t border-gray-100 dark:border-gray-700">
              <div className="text-center p-3 bg-pink-50 dark:bg-pink-900/10
                              rounded-xl">
                <p className="text-lg font-bold text-[#e5007e]">
                  {customer.totalVisits ?? 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">ביקורים</p>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50
                              rounded-xl">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {customer.lastVisit ? formatDate(customer.lastVisit) : '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">ביקור אחרון</p>
              </div>
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

        {/* ── עמודה ימין: Timeline ──────────────────────────────────────── */}
        <div className="w-full md:w-2/3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm
                          border border-gray-100 dark:border-gray-700 min-h-[500px]">

            {/* כותרת + כפתור הוספה */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                היסטוריית טיפולים
              </h3>
              <button onClick={() => setIsAdding((p) => !p)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl
                            transition-colors text-sm font-medium ${
                  isAdding
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    : 'bg-[#e5007e]/10 text-[#e5007e] hover:bg-[#e5007e] hover:text-white'
                }`}>
                {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {isAdding ? 'ביטול' : 'הוסיפי טיפול'}
              </button>
            </div>

            {/* טופס הוספת טיפול */}
            {isAdding && (
              <form ref={formRef} onSubmit={handleAddTreatment}
                className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl
                           border border-gray-200 dark:border-gray-600 overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600
                                      dark:text-gray-400 mb-1">
                      שם הטיפול <span className="text-[#e5007e]">*</span>
                    </label>
                    <input required type="text" value={newTreatment.title}
                      onChange={set('title')} className={inputCls}
                      placeholder="לדוג׳: מילוי אקריל" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600
                                      dark:text-gray-400 mb-1">תאריך</label>
                    <input required type="date" value={newTreatment.date}
                      onChange={set('date')} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600
                                      dark:text-gray-400 mb-1">מחיר (₪)</label>
                    <input type="number" min="0" value={newTreatment.price}
                      onChange={set('price')} placeholder="0" className={inputCls} />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600
                                    dark:text-gray-400 mb-1">הערות לטיפול</label>
                  <textarea rows={2} value={newTreatment.notes}
                    onChange={set('notes')} className={`${inputCls} resize-none`}
                    placeholder="גוון שהשתמשתי, בקשות מיוחדות..." />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300
                               hover:bg-gray-200 dark:hover:bg-gray-600
                               rounded-lg transition-colors">
                    ביטול
                  </button>
                  <button type="submit" disabled={saving || !newTreatment.title.trim()}
                    className="px-4 py-2 text-sm bg-[#e5007e] hover:bg-[#b30062]
                               text-white rounded-lg transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed
                               shadow-md shadow-pink-500/20">
                    {saving ? 'שומר...' : 'שמירת טיפול'}
                  </button>
                </div>
              </form>
            )}

            {/* Timeline */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-[#e5007e] border-t-transparent
                                rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500 text-sm">{error}</div>
            ) : treatments.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">אין היסטוריית טיפולים עדיין</p>
                <button onClick={() => setIsAdding(true)}
                  className="mt-3 text-sm text-[#e5007e] font-semibold hover:underline">
                  + הוסיפי טיפול ראשון
                </button>
              </div>
            ) : (
              <div ref={timelineRef}
                className="relative border-r-2 border-[#e5007e]/20
                           dark:border-[#e5007e]/30 pr-6 space-y-6 mt-2">
                {treatments.map((treatment) => (
                  <div key={treatment.id} className="timeline-item relative">
                    {/* נקודה על הציר */}
                    <span className="absolute -right-[31px] top-2 w-4 h-4 rounded-full
                                     bg-white dark:bg-gray-800
                                     border-4 border-[#e5007e]" />

                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4
                                    border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 dark:text-white truncate">
                            {treatment.title}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400
                                        flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {/* formatDate מונע בעיית timezone */}
                            {formatDate(treatment.date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {treatment.price > 0 && (
                            <span className="font-semibold text-[#e5007e]
                                             bg-[#e5007e]/10 px-3 py-1 rounded-lg text-sm">
                              ₪{treatment.price.toLocaleString()}
                            </span>
                          )}
                          {/* תמיד גלוי — ידידותי למובייל */}
                          <button
                            onClick={() => setDeletingTreatment(treatment)}
                            className="p-1.5 text-gray-400 hover:text-red-500
                                       hover:bg-red-50 dark:hover:bg-red-900/20
                                       rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {treatment.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-3
                                      bg-white dark:bg-gray-800 p-3 rounded-lg
                                      border border-gray-100 dark:border-gray-700">
                          {treatment.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal מחיקת טיפול */}
      <DeleteTreatmentModal
        isOpen={!!deletingTreatment}
        treatmentTitle={deletingTreatment?.title ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTreatment(null)}
      />
    </div>
  );
}