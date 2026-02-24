// src/components/dashboard/Calendar.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppointments } from '../../hooks/useAppointments';
import { useCustomers }    from '../../hooks/useCustomers';
import { useToast }        from '../../context/ToastContext';
import {
  ChevronRight, ChevronLeft, Calendar as CalendarIcon,
  Plus, Clock, User, X, Trash2, CheckCircle,
  AlertCircle, Edit, Search,
} from 'lucide-react';
import gsap from 'gsap';

// ── Helpers ────────────────────────────────────────────────────────────────

// בונה תאריך ללא בעיית timezone
function toDateStr(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// הופך YYYY-MM-DD → Date object ללא timezone shift
function fromDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const STATUS_META = {
  scheduled: { label: 'מתוכנן', cls: 'bg-blue-50  text-blue-600  dark:bg-blue-900/20  dark:text-blue-400'  },
  completed:  { label: 'הושלם',  cls: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
  cancelled:  { label: 'בוטל',   cls: 'bg-gray-100 text-gray-500  dark:bg-gray-700     dark:text-gray-400'  },
};

const EMPTY_FORM = {
  customerId: '', title: '', date: toDateStr(new Date()),
  startTime: '10:00', endTime: '11:00', status: 'scheduled',
};

// ── CustomerSelect ─────────────────────────────────────────────────────────

function CustomerSelect({ customers, value, onChange }) {
  const [search,  setSearch]  = useState('');
  const [isOpen,  setIsOpen]  = useState(false);
  const wrapperRef = useRef(null);

  const selectedCustomer = customers.find((c) => c.id === value);

  // סנכרון תצוגה עם הלקוחה שנבחרה
  useEffect(() => {
    if (!isOpen) {
      setSearch(
        selectedCustomer
          ? `${selectedCustomer.name} (${selectedCustomer.phone})`
          : ''
      );
    }
  }, [value, isOpen, selectedCustomer]);

  // סגירה בלחיצה מחוץ לרכיב
  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        // אם יצאו מבלי לבחור — מנקה customerId
        if (!selectedCustomer) onChange('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [selectedCustomer, onChange]);

  const filtered = useMemo(() =>
    customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    ),
  [customers, search]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2
                           w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          className="w-full pl-3 pr-9 py-2.5 rounded-xl
                     border border-gray-200 dark:border-gray-600
                     bg-gray-50 dark:bg-gray-700 dark:text-white text-sm
                     outline-none focus:border-[#e5007e]
                     focus:ring-1 focus:ring-[#e5007e] transition-all"
          placeholder="חפשי לקוחה לפי שם או טלפון..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            // אם מוחקים את הטקסט — מנקה את הבחירה
            if (!e.target.value) onChange('');
          }}
          onClick={() => {
            setSearch('');
            setIsOpen(true);
          }}
        />
      </div>

      {isOpen && (
        <ul className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto
                       bg-white dark:bg-gray-800
                       border border-gray-100 dark:border-gray-700
                       rounded-xl shadow-xl">
          {filtered.length === 0 ? (
            <li className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              לא נמצאו לקוחות
            </li>
          ) : (
            filtered.map((c) => (
              <li
                key={c.id}
                onMouseDown={(e) => e.preventDefault()} // מונע סגירה לפני onClick
                onClick={() => {
                  onChange(c.id);
                  setIsOpen(false);
                }}
                className="p-3 text-sm hover:bg-pink-50 dark:hover:bg-gray-700
                           cursor-pointer dark:text-white
                           flex justify-between items-center transition-colors"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-gray-400 text-xs" dir="ltr">{c.phone}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ── DeleteAppointmentModal ─────────────────────────────────────────────────

function DeleteAppointmentModal({ isOpen, appointmentTitle, onConfirm, onCancel }) {
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1,    y: 0, duration: 0.25, ease: 'back.out(1.4)' }
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
            <h3 className="font-bold text-gray-800 dark:text-gray-100">מחיקת תור</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              למחוק את התור{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                "{appointmentTitle}"
              </span>? פעולה זו אינה ניתנת לביטול.
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
            מחק תור
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AppointmentModal ───────────────────────────────────────────────────────

function AppointmentModal({ isOpen, onClose, onSave, selectedDate, initialData }) {
  const { customers } = useCustomers();
  const overlayRef    = useRef(null);
  const modalRef      = useRef(null);
  const [saving,   setSaving]   = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const isEditing = !!initialData?.id;

  useEffect(() => {
    if (!isOpen) return;
    setFormData(
      initialData
        ? { ...EMPTY_FORM, ...initialData }
        : { ...EMPTY_FORM, date: selectedDate ?? toDateStr(new Date()) }
    );
    setSaving(false);
  }, [isOpen, initialData, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0,  scale: 1,  duration: 0.3, ease: 'power3.out' }
    );
  }, [isOpen]);

  const handleClose = () => {
    gsap.to(modalRef.current,   { opacity: 0, y: 20, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const set = (field) => (e) =>
    setFormData((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    // וולידציה — לקוחה נבחרה
    if (!formData.customerId) {
      alert('יש לבחור לקוחה מהרשימה');
      return;
    }

    // וולידציה — שעות
    if (formData.endTime <= formData.startTime) {
      alert('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
      return;
    }

    setSaving(true);
    const customer = customers.find((c) => c.id === formData.customerId);
    
    try {
      await onSave({
        ...formData,
        customerName:  customer?.name  ?? 'לקוחה לא ידועה',
        customerPhone: customer?.phone ?? '',
      });
      handleClose();
    } catch (err) {
      console.error('[AppointmentModal]', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = `w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600
    bg-gray-50 dark:bg-gray-700 dark:text-white text-sm outline-none
    focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all`;

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      dir="rtl"
    >
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                   w-full max-w-md overflow-hidden">

        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700
                        flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {isEditing ? 'עריכת תור' : 'תור חדש'}
          </h2>
          <button onClick={handleClose}
            className="p-2 text-gray-400 hover:text-[#e5007e] rounded-full
                       hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* לקוחה */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              לקוחה <span className="text-[#e5007e]">*</span>
            </label>
            <CustomerSelect
              customers={customers}
              value={formData.customerId}
              onChange={(val) => setFormData((p) => ({ ...p, customerId: val }))}
            />
            {/* הודעת שגיאה ויזואלית אם לא נבחרה לקוחה */}
            {!formData.customerId && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 pr-1">
                חפשי לפי שם או מספר טלפון ובחרי מהרשימה
              </p>
            )}
          </div>

          {/* סוג טיפול */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              סוג הטיפול <span className="text-[#e5007e]">*</span>
            </label>
            <input required type="text" value={formData.title}
              onChange={set('title')}
              placeholder="לדוג׳: לק ג׳ל / עיצוב גבות"
              className={inputCls} />
          </div>

          {/* תאריך */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              תאריך <span className="text-[#e5007e]">*</span>
            </label>
            <input required type="date" value={formData.date}
              onChange={set('date')} className={inputCls} />
          </div>

          {/* שעות */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">
                שעת התחלה <span className="text-[#e5007e]">*</span>
              </label>
              <input required type="time" value={formData.startTime}
                onChange={set('startTime')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">
                שעת סיום <span className="text-[#e5007e]">*</span>
              </label>
              <input required type="time" value={formData.endTime}
                onChange={set('endTime')} className={inputCls} />
            </div>
          </div>

          {/* סטטוס — רק בעריכה */}
          {isEditing && (
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">סטטוס</label>
              <select value={formData.status} onChange={set('status')} className={inputCls}>
                <option value="scheduled">מתוכנן</option>
                <option value="completed">הושלם</option>
                <option value="cancelled">בוטל</option>
              </select>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         text-sm font-medium text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              ביטול
            </button>
            <button type="submit"
              disabled={saving || !formData.customerId || !formData.title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#e5007e] hover:bg-[#b30062]
                         text-white text-sm font-bold transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-pink-500/20">
              {saving ? 'שומר...' : isEditing ? 'שמור שינויים' : 'קביעת תור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AppointmentCard ────────────────────────────────────────────────────────

function AppointmentCard({ apt, onEdit, onDelete, onStatusChange }) {
  const meta = STATUS_META[apt.status] ?? STATUS_META.scheduled;

  return (
    <div className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border
                     transition-all hover:shadow-md ${
      apt.status === 'completed'
        ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-800/50'
        : apt.status === 'cancelled'
        ? 'bg-gray-50 border-gray-200 dark:bg-gray-700/20 dark:border-gray-700 opacity-60'
        : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700'
    }`}>
      
      {/* שעה */}
      <div className="flex items-center sm:flex-col sm:items-center gap-2 sm:gap-0
                      sm:w-24 shrink-0 text-center
                      border-b sm:border-b-0 sm:border-l
                      border-gray-200 dark:border-gray-600
                      pb-3 sm:pb-0 sm:pl-4">
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          {apt.startTime}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400
                         flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" /> עד {apt.endTime}
        </span>
      </div>

      {/* פרטים */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
            {apt.title}
          </h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                            shrink-0 ${meta.cls}`}>
            {meta.label}
          </span>
        </div>
        <p className="flex items-center gap-1.5 mt-1 text-sm
                      text-gray-600 dark:text-gray-400">
          <User className="w-3.5 h-3.5 text-[#e5007e] shrink-0" />
          {apt.customerName}
          {apt.customerPhone && (
            <span className="text-gray-400 dark:text-gray-500" dir="ltr">
              · {apt.customerPhone}
            </span>
          )}
        </p>
      </div>

      {/* כפתורי פעולה */}
      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
        {apt.status === 'scheduled' && (
          <button onClick={() => onStatusChange(apt.id, 'completed')}
            title="סמני כהושלם"
            className="p-2 text-green-500 hover:bg-green-50
                       dark:hover:bg-green-900/20 rounded-lg transition-colors">
            <CheckCircle className="w-5 h-5" />
          </button>
        )}
        <button onClick={() => onEdit(apt)}
          title="עריכה"
          className="p-2 text-gray-400 hover:text-[#e5007e]
                     hover:bg-pink-50 dark:hover:bg-pink-900/20
                     rounded-lg transition-colors">
          <Edit className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(apt)}
          title="מחיקה"
          className="p-2 text-gray-400 hover:text-red-500
                     hover:bg-red-50 dark:hover:bg-red-900/20
                     rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main: Calendar ─────────────────────────────────────────────────────────

export default function Calendar() {
  const {
    loading, error,
    getByDate, addAppointment, updateAppointment, deleteAppointment,
    stats,
  } = useAppointments();
  
  const { showToast } = useToast();
  
  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingApt,   setEditingApt]   = useState(null);
  const [deletingApt,  setDeletingApt]  = useState(null);
  const listRef = useRef(null);

  const dateString        = useMemo(() => toDateStr(currentDate), [currentDate]);
  const dailyAppointments = getByDate(dateString);

  useEffect(() => {
    if (!listRef.current) return;
    const items = Array.from(listRef.current.children).filter(Boolean);
    if (!items.length) return;
    gsap.fromTo(items,
      { y: 20, opacity: 0 },
      { y: 0,  opacity: 1, duration: 0.3, stagger: 0.06, ease: 'power2.out' }
    );
  }, [dateString, dailyAppointments.length]);

  const changeDay = (delta) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  };

  const handleSave = async (data) => {
    try {
      if (editingApt?.id) {
        await updateAppointment(editingApt.id, data);
        showToast('התור עודכן בהצלחה ✓', 'success');
      } else {
        await addAppointment(data);
        showToast('התור נקבע בהצלחה ✓', 'success');
        setCurrentDate(fromDateStr(data.date));
      }
      setEditingApt(null);
    } catch (err) {
      showToast(err.message || 'שגיאה בשמירה', 'error');
      throw err;
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAppointment(id, { status: newStatus });
      showToast('סטטוס עודכן ✓', 'success');
    } catch {
      showToast('שגיאה בעדכון', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingApt) return;
    try {
      await deleteAppointment(deletingApt.id);
      showToast('התור נמחק', 'success');
    } catch {
      showToast('שגיאה במחיקה', 'error');
    } finally {
      setDeletingApt(null);
    }
  };

  const openAdd          = ()    => { setEditingApt(null); setIsModalOpen(true); };
  const openEdit         = (apt) => { setEditingApt(apt);  setIsModalOpen(true); };
  const handleModalClose = ()    => { setIsModalOpen(false); setEditingApt(null); };

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent
                      rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'מתוכננים', value: stats.scheduled, cls: 'text-blue-500'  },
          { label: 'הושלמו',   value: stats.completed,  cls: 'text-green-500' },
          { label: 'בוטלו',    value: stats.cancelled,  cls: 'text-gray-400'  },
        ].map(({ label, value, cls }) => (
          <div key={label}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center
                       shadow-sm border border-gray-100 dark:border-gray-700">
            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4
                      bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm
                      border border-gray-100 dark:border-gray-700">
        
        <button onClick={openAdd}
          className="w-full sm:w-auto flex items-center justify-center gap-2
                     px-6 py-3 bg-[#e5007e] text-white rounded-xl
                     hover:bg-[#b30062] shadow-lg shadow-pink-500/20
                     transition-all font-bold">
          <Plus className="w-5 h-5" /> תור חדש
        </button>

        <div className="flex items-center gap-3">
          <button onClick={() => changeDay(-1)}
            className="p-2 text-gray-500 hover:text-[#e5007e] hover:bg-pink-50
                       dark:hover:bg-gray-700 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Datepicker שקוף על הטקסט */}
          <div className="relative text-center min-w-[170px] group cursor-pointer">
            <div className="flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center gap-2
                              text-gray-900 dark:text-white
                              group-hover:text-[#e5007e] transition-colors">
                <CalendarIcon className="w-5 h-5 text-[#e5007e]" />
                <h2 className="text-lg font-bold">
                  {currentDate.toLocaleDateString('he-IL', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </h2>
                <input
                  type="date"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  value={dateString}
                  onChange={(e) => {
                    if (e.target.value) setCurrentDate(fromDateStr(e.target.value));
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                יום {HE_DAYS[currentDate.getDay()]}
              </p>
            </div>
          </div>

          <button onClick={() => changeDay(1)}
            className="p-2 text-gray-500 hover:text-[#e5007e] hover:bg-pink-50
                       dark:hover:bg-gray-700 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        <button onClick={() => setCurrentDate(new Date())}
          className="px-4 py-2 text-sm font-semibold text-[#e5007e]
                     bg-pink-50 dark:bg-[#e5007e]/10 rounded-xl
                     hover:bg-pink-100 dark:hover:bg-[#e5007e]/20 transition-colors">
          היום
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600
                        dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Agenda */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm
                      border border-gray-100 dark:border-gray-700 min-h-[400px]">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-gray-800 dark:text-white">תורים ליום זה</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {dailyAppointments.length} תורים
          </span>
        </div>

        {dailyAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20
                          text-gray-400 dark:text-gray-500">
            <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-base">אין תורים ביום זה</p>
            <button onClick={openAdd}
              className="mt-3 text-sm text-[#e5007e] font-semibold hover:underline">
              + קבעי תור ראשון
            </button>
          </div>
        ) : (
          <div ref={listRef} className="space-y-3">
            {dailyAppointments.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                onEdit={openEdit}
                onDelete={setDeletingApt}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        selectedDate={dateString}
        initialData={editingApt}
      />

      <DeleteAppointmentModal
        isOpen={!!deletingApt}
        appointmentTitle={deletingApt?.title ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingApt(null)}
      />
    </div>
  );
}