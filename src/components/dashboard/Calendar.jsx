// src/components/dashboard/Calendar.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppointments } from '../../hooks/useAppointments';
import { useCustomers }    from '../../hooks/useCustomers';
import { useServices }     from '../../hooks/useServices';
import { useTransactions } from '../../hooks/useTransactions';
import { useToast }        from '../../context/ToastContext';
import {
  ChevronRight, ChevronLeft, Calendar as CalendarIcon,
  Plus, Clock, User, UserPlus, X, Trash2, CheckCircle,
  AlertCircle, Edit, Search, Tag, Wallet, Check,
  LayoutList, CalendarDays, Minus,
} from 'lucide-react';
import gsap from 'gsap';

// ── Helpers ────────────────────────────────────────────────────────────────

function toDateStr(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr || !minutesToAdd) return timeStr;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(2000, 0, 1, hours, minutes + Number(minutesToAdd));
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const HE_DAYS       = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const inputCls = `w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600
  bg-gray-50 dark:bg-gray-700 dark:text-white text-sm outline-none
  focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all`;

const STATUS_META = {
  scheduled: { label: 'מתוכנן', cls: 'bg-blue-50  text-blue-600  dark:bg-blue-900/20  dark:text-blue-400'  },
  completed:  { label: 'הושלם',  cls: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
  cancelled:  { label: 'בוטל',   cls: 'bg-gray-100 text-gray-500  dark:bg-gray-700     dark:text-gray-400'  },
};

const EMPTY_FORM = {
  customerId: '',
  services:   [],
  title:      '',
  date:       toDateStr(new Date()),
  startTime:  '10:00',
  endTime:    '11:00',
  status:     'scheduled',
  price:      0,
  color:      '#e5007e',
};

// ── ServiceSelector ────────────────────────────────────────────────────────
// ✅ תוספת: כפתור X להסרה מלאה של שירות (בנוסף ל-Minus שמוריד כמות)

function ServiceSelector({ activeServices, selectedServices, onChange, startTime }) {

  const addService = (serviceId) => {
    if (!serviceId || serviceId === 'placeholder') return;

    if (serviceId === 'custom') {
      // custom מטופל בקומפוננט האב
      onChange(selectedServices, true);
      return;
    }

    const service = activeServices.find((s) => s.id === serviceId);
    if (!service) return;

    const existing = selectedServices.findIndex((s) => s.serviceId === serviceId);
    if (existing >= 0) {
      const updated = [...selectedServices];
      updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 };
      onChange(updated);
    } else {
      onChange([...selectedServices, {
        serviceId: service.id,
        title:     service.title,
        price:     Number(service.price),
        color:     service.color ?? '#e5007e',
        duration:  Number(service.duration),
        qty:       1,
      }]);
    }
  };

  const changeQty = (serviceId, delta) => {
    const updated = selectedServices
      .map((s) => s.serviceId === serviceId ? { ...s, qty: s.qty + delta } : s)
      .filter((s) => s.qty > 0);
    onChange(updated);
  };

  // ✅ הסרה מיידית של שירות בלחיצת X
  const removeService = (serviceId) => {
    onChange(selectedServices.filter((s) => s.serviceId !== serviceId));
  };

  const totalPrice    = selectedServices.reduce((sum, s) => sum + s.price * s.qty, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration * s.qty, 0);
  const endTime       = totalDuration > 0 ? addMinutesToTime(startTime, totalDuration) : null;

  return (
    <div className="space-y-3">
      {/* רשימת שירותים שנבחרו */}
      {selectedServices.length > 0 && (
        <div className="space-y-2">
          {selectedServices.map((s) => (
            <div key={s.serviceId}
              className="flex items-center gap-2 p-2.5 rounded-xl
                         bg-pink-50 dark:bg-[#e5007e]/10
                         border border-pink-100 dark:border-[#e5007e]/20
                         group transition-all">

              {/* ✅ כפתור X להסרה — נראה בhover */}
              <button
                type="button"
                onClick={() => removeService(s.serviceId)}
                title="הסר שירות"
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center
                           text-gray-300 hover:text-white hover:bg-red-400
                           dark:text-gray-600 dark:hover:bg-red-500
                           transition-all duration-150">
                <X className="w-3 h-3" />
              </button>

              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                   style={{ backgroundColor: s.color }} />

              <span className="text-sm font-medium text-gray-800 dark:text-white flex-1 truncate">
                {s.title}
              </span>

              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                {s.duration * s.qty} דק׳
              </span>

              {/* שלטי כמות */}
              <div className="flex items-center gap-1 shrink-0">
                <button type="button"
                  onClick={() => changeQty(s.serviceId, -1)}
                  className="w-6 h-6 rounded-full bg-white dark:bg-gray-700
                             border border-gray-200 dark:border-gray-600
                             text-gray-500 hover:text-red-500
                             flex items-center justify-center transition-colors">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-bold text-gray-800 dark:text-white w-5 text-center">
                  {s.qty}
                </span>
                <button type="button"
                  onClick={() => changeQty(s.serviceId, 1)}
                  className="w-6 h-6 rounded-full bg-white dark:bg-gray-700
                             border border-gray-200 dark:border-gray-600
                             text-gray-500 hover:text-[#e5007e]
                             flex items-center justify-center transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <span className="text-sm font-bold text-[#e5007e] shrink-0 min-w-[52px] text-left">
                ₪{(s.price * s.qty).toLocaleString('he-IL')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown להוספת שירות */}
      <select
        value="placeholder"
        onChange={(e) => addService(e.target.value)}
        className={inputCls}
      >
        <option value="placeholder">
          {selectedServices.length === 0 ? '+ בחרי טיפול מהמחירון...' : '+ הוסיפי טיפול נוסף'}
        </option>
        {activeServices.length === 0 && (
          <option value="" disabled>— אין שירותים מוגדרים —</option>
        )}
        {activeServices.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} · {s.duration} דק׳ · ₪{Number(s.price).toLocaleString('he-IL')}
          </option>
        ))}
        <option value="custom">— טיפול מותאם אישית / אחר —</option>
      </select>

      {/* סיכום */}
      {selectedServices.length > 0 && (
        <div className="flex justify-between items-center text-xs
                        text-gray-500 dark:text-gray-400 px-1 pt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {totalDuration} דק׳{endTime ? ` · יסתיים ב-${endTime}` : ''}
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            סה״כ: ₪{totalPrice.toLocaleString('he-IL')}
          </span>
        </div>
      )}

      {activeServices.length === 0 && (
        <p className="text-[11px] text-amber-500 pr-1">
          💡 פתחי "שירותים ומחירון" כדי להוסיף טיפולים
        </p>
      )}
    </div>
  );
}

// ── CustomerSelect ─────────────────────────────────────────────────────────

function CustomerSelect({ customers, value, onChange }) {
  const [search,  setSearch] = useState('');
  const [isOpen,  setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedCustomer = customers.find((c) => c.id === value);

  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedCustomer
        ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
        : ''
      );
    }
  }, [value, isOpen, selectedCustomer]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        if (!selectedCustomer) onChange('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [selectedCustomer, onChange]);

  const filtered = useMemo(() =>
    customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    ),
  [customers, search]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2
                           w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          className={`${inputCls} pr-9`}
          placeholder="חפשי לקוחה לפי שם או טלפון..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            if (!e.target.value) onChange('');
          }}
          onClick={() => { setSearch(''); setIsOpen(true); }}
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(c.id); setIsOpen(false); }}
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
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1,    y: 0,  duration: 0.25, ease: 'back.out(1.4)' }
    );
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}>
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
        dir="rtl">
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

// ── ChargeModal ────────────────────────────────────────────────────────────

function ChargeModal({ isOpen, appointment, onConfirmWithCharge, onConfirmWithoutCharge, onCancel }) {
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);

  useEffect(() => {
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1,    y: 0,  duration: 0.25, ease: 'back.out(1.4)' }
    );
  }, [isOpen]);

  if (!isOpen || !appointment) return null;

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}>
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        dir="rtl">

        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 flex flex-col
                        items-center text-center border-b
                        border-emerald-100 dark:border-emerald-800/50">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-800 rounded-full
                          flex items-center justify-center mb-3
                          text-emerald-600 dark:text-emerald-400 shadow-inner">
            <Check size={28} strokeWidth={3} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            הטיפול הסתיים! 🎉
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            האם תרצי להוסיף את התשלום של{' '}
            <span className="font-bold text-gray-900 dark:text-white">
              {appointment.customerName}
            </span>{' '}
            להכנסות?
          </p>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center
                          bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-5">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <Tag size={16} className="text-[#e5007e]" />
              <span className="font-medium text-sm">{appointment.title}</span>
            </div>
            <div className="font-bold text-xl text-emerald-600 dark:text-emerald-400">
              ₪{Number(appointment.price).toLocaleString('he-IL')}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onConfirmWithCharge(appointment)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600
                         text-white font-bold transition-colors
                         flex justify-center items-center gap-2
                         shadow-lg shadow-emerald-500/20">
              <Wallet size={18} /> הוסף הכנסה וסמן כהושלם
            </button>
            <button
              onClick={() => onConfirmWithoutCharge(appointment)}
              className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600
                         text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700
                         font-medium transition-colors text-sm">
              רק סמן כהושלם (ללא הכנסה)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AppointmentModal ───────────────────────────────────────────────────────

function AppointmentModal({ isOpen, onClose, onSave, selectedDate, initialData }) {
  const { customers, addCustomer } = useCustomers();
  const { activeServices }         = useServices();
  const { showToast }              = useToast();

  const overlayRef = useRef(null);
  const modalRef   = useRef(null);

  const [saving,              setSaving]              = useState(false);
  const [formData,            setFormData]            = useState(EMPTY_FORM);
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustomer,         setNewCustomer]         = useState({ name: '', phone: '' });
  const [savingNewCustomer,   setSavingNewCustomer]   = useState(false);
  const [customTitle,         setCustomTitle]         = useState('');
  const [showCustomInput,     setShowCustomInput]     = useState(false);

  const isEditing = !!initialData?.id;

  // ── איפוס בכל פתיחה ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      // ✅ תיקון עריכה: טוען services קיימים
      // אם יש services מערך — טוען אותם
      // אם אין (תור ישן) — מנסה לבנות מ-title/price
      const existingServices = initialData.services?.length > 0
        ? initialData.services
        : [];

      setFormData({
        ...EMPTY_FORM,
        ...initialData,
        services: existingServices,
      });

      // אם יש title אבל אין services (תור ישן שנוצר לפני המבנה החדש)
      if (!initialData.services?.length && initialData.title) {
        setCustomTitle(initialData.title);
        setShowCustomInput(true);
      } else {
        setCustomTitle('');
        setShowCustomInput(false);
      }
    } else {
      setFormData({ ...EMPTY_FORM, date: selectedDate ?? toDateStr(new Date()) });
      setCustomTitle('');
      setShowCustomInput(false);
    }

    setSaving(false);
    setIsAddingNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
  }, [isOpen, initialData, selectedDate]);

  // ── אנימציה ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0,  scale: 1,    duration: 0.3, ease: 'power3.out' }
    );
  }, [isOpen]);

  const handleClose = () => {
    if (!modalRef.current || !overlayRef.current) { onClose(); return; }
    gsap.to(modalRef.current,   { opacity: 0, y: 20, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const set = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  // ── שינוי services — מחשב title/price/endTime אוטומטית ───────────
  // ✅ תיקון: ServiceSelector מעביר (services, isCustom) 
  const handleServicesChange = useCallback((newServices, isCustom = false) => {
    if (isCustom) {
      setShowCustomInput(true);
      return;
    }

    const totalDuration = newServices.reduce((sum, s) => sum + s.duration * s.qty, 0);
    const totalPrice    = newServices.reduce((sum, s) => sum + s.price * s.qty, 0);
    const titles        = newServices.map((s) => s.qty > 1 ? `${s.title} x${s.qty}` : s.title);
    const firstColor    = newServices[0]?.color ?? '#e5007e';

    setFormData((p) => ({
      ...p,
      services:  newServices,
      title:     titles.join(' + ') || '',
      price:     totalPrice,
      color:     firstColor,
      endTime:   totalDuration > 0 ? addMinutesToTime(p.startTime, totalDuration) : p.endTime,
    }));

    if (newServices.length > 0) {
      setShowCustomInput(false);
      setCustomTitle('');
    }
  }, []);

  // ── הוספת לקוחה מהירה ─────────────────────────────────────────────
  const handleQuickAddCustomer = async () => {
    const name  = newCustomer.name.trim();
    const phone = newCustomer.phone.trim();
    if (!name) { showToast('חובה להזין שם לקוחה', 'error'); return; }

    setSavingNewCustomer(true);
    try {
      const newId = await addCustomer({ name, phone });
      set('customerId', newId);
      setIsAddingNewCustomer(false);
      setNewCustomer({ name: '', phone: '' });
      showToast(`"${name}" נוספה ונבחרה! 🎉`, 'success');
    } catch {
      showToast('שגיאה בשמירת הלקוחה', 'error');
    } finally {
      setSavingNewCustomer(false);
    }
  };

  // ── שינוי שעת התחלה → עדכון שעת סיום ────────────────────────────
  const handleStartTimeChange = (newStartTime) => {
    setFormData((p) => {
      const totalDuration = p.services.reduce((sum, s) => sum + s.duration * s.qty, 0);
      return {
        ...p,
        startTime: newStartTime,
        endTime: totalDuration > 0
          ? addMinutesToTime(newStartTime, totalDuration)
          : p.endTime,
      };
    });
  };

  // ── שמירה ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const finalTitle = showCustomInput ? customTitle.trim() : formData.title.trim();

    if (!formData.customerId) { showToast('יש לבחור לקוחה', 'error'); return; }
    if (!finalTitle)          { showToast('יש לבחור לפחות טיפול אחד', 'error'); return; }
    if (formData.endTime <= formData.startTime) {
      showToast('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error'); return;
    }

    setSaving(true);
    const customer = customers.find((c) => c.id === formData.customerId);

    try {
      await onSave({
        ...formData,
        title:         finalTitle,
        price:         Number(formData.price) || 0,
        customerName:  customer?.name  ?? 'לקוחה לא ידועה',
        customerPhone: customer?.phone ?? '',
      });
      handleClose();
    } catch (err) {
      console.error('[AppointmentModal]', err);
      showToast('שגיאה בשמירת התור', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasServices = formData.services.length > 0 || (showCustomInput && customTitle.trim());
  const canSubmit   = formData.customerId && hasServices && !saving;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      dir="rtl"
    >
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                   w-full max-w-md my-4 overflow-hidden">

        {/* כותרת */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700
                        flex justify-between items-center
                        sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {isEditing ? 'עריכת תור ✏️' : 'תור חדש ✨'}
          </h2>
          <button onClick={handleClose}
            className="p-2 text-gray-400 hover:text-[#e5007e] rounded-full
                       hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* ── לקוחה ─────────────────────────────────────────────── */}
          <div>
            {isAddingNewCustomer ? (
              <div className="bg-pink-50/60 dark:bg-[#e5007e]/10 p-4 rounded-xl
                              border border-pink-100 dark:border-[#e5007e]/20 relative">
                <button type="button"
                  onClick={() => { setIsAddingNewCustomer(false); setNewCustomer({ name: '', phone: '' }); }}
                  className="absolute top-3 left-3 p-1 text-gray-400
                             hover:text-gray-600 rounded-full transition-colors">
                  <X size={15} />
                </button>
                <h4 className="text-sm font-bold text-[#e5007e] flex items-center gap-1.5 mb-3">
                  <UserPlus size={15} /> לקוחה חדשה
                </h4>
                <div className="space-y-2.5">
                  <input type="text" placeholder="שם מלא *"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddCustomer())}
                    className={inputCls} autoFocus />
                  <input type="tel" placeholder="טלפון (אופציונלי)"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddCustomer())}
                    className={inputCls} dir="ltr" />
                  <button type="button" onClick={handleQuickAddCustomer}
                    disabled={savingNewCustomer || !newCustomer.name.trim()}
                    className="w-full py-2 bg-[#e5007e] hover:bg-[#b30062]
                               text-white font-bold rounded-xl text-sm
                               disabled:opacity-50 transition-colors
                               shadow-md shadow-pink-500/20">
                    {savingNewCustomer ? 'שומר...' : '✓ שמירה ובחירה'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label className="block text-xs font-semibold text-gray-600
                                  dark:text-gray-400 mb-1">
                  לקוחה <span className="text-[#e5007e]">*</span>
                </label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <CustomerSelect
                      customers={customers}
                      value={formData.customerId}
                      onChange={(val) => set('customerId', val)}
                    />
                  </div>
                  <button type="button"
                    onClick={() => setIsAddingNewCustomer(true)}
                    title="הוספת לקוחה חדשה"
                    className="h-[42px] px-3 bg-pink-50 dark:bg-[#e5007e]/10
                               text-[#e5007e] font-bold rounded-xl shrink-0
                               hover:bg-pink-100 dark:hover:bg-[#e5007e]/20
                               transition-colors flex items-center gap-1.5 text-sm">
                    <UserPlus size={16} />
                    <span className="hidden sm:inline">חדשה</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── טיפולים ──────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                טיפולים <span className="text-[#e5007e]">*</span>
              </span>
            </label>

            {showCustomInput ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="שם הטיפול המותאם..."
                  className={inputCls}
                  autoFocus
                />
                <button type="button"
                  onClick={() => { setShowCustomInput(false); setCustomTitle(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600
                             dark:hover:text-gray-300 underline transition-colors">
                  ← חזור לבחירה מהמחירון
                </button>
              </div>
            ) : (
              <ServiceSelector
                activeServices={activeServices}
                selectedServices={formData.services}
                onChange={handleServicesChange}
                startTime={formData.startTime}
              />
            )}

            {!showCustomInput && formData.services.length === 0 && (
              <button type="button"
                onClick={() => setShowCustomInput(true)}
                className="mt-2 text-xs text-gray-400 hover:text-[#e5007e]
                           transition-colors underline">
                + טיפול מותאם אישית שאינו במחירון
              </button>
            )}
          </div>

          {/* ── תאריך ─────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              תאריך <span className="text-[#e5007e]">*</span>
            </label>
            <input required type="date" value={formData.date}
              onChange={(e) => set('date', e.target.value)} className={inputCls} />
          </div>

          {/* ── שעות ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">
                שעת התחלה <span className="text-[#e5007e]">*</span>
              </label>
              <input required type="time" value={formData.startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">
                שעת סיום <span className="text-[#e5007e]">*</span>
              </label>
              <input required type="time" value={formData.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                className={inputCls} />
            </div>
          </div>

          {/* משך */}
          {formData.startTime && formData.endTime && formData.endTime > formData.startTime && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1 pr-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              משך: {(() => {
                const [sh, sm] = formData.startTime.split(':').map(Number);
                const [eh, em] = formData.endTime.split(':').map(Number);
                const diff = (eh * 60 + em) - (sh * 60 + sm);
                return diff >= 60
                  ? `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')} שעות`
                  : `${diff} דקות`;
              })()}
            </p>
          )}

          {/* ── סטטוס (עריכה בלבד) ─────────────────────────────────── */}
          {isEditing && (
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">סטטוס</label>
              <select value={formData.status}
                onChange={(e) => set('status', e.target.value)} className={inputCls}>
                <option value="scheduled">מתוכנן</option>
                <option value="completed">הושלם</option>
                <option value="cancelled">בוטל</option>
              </select>
            </div>
          )}

          {/* ── כפתורים ─────────────────────────────────────────────── */}
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         text-sm font-medium text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              ביטול
            </button>
            <button type="submit" disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl bg-[#e5007e] hover:bg-[#b30062]
                         text-white text-sm font-bold transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-pink-500/20">
              {saving ? 'שומר...' : isEditing ? '💾 שמור שינויים' : '✅ קביעת תור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── AppointmentCard ────────────────────────────────────────────────────────

function AppointmentCard({ apt, onEdit, onDelete, onCompleteClick }) {
  const meta = STATUS_META[apt.status] ?? STATUS_META.scheduled;

  return (
    <div className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border
                     transition-all hover:shadow-md ${
      apt.status === 'completed'
        ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-800/50'
        : apt.status === 'cancelled'
        ? 'bg-gray-50 border-gray-200 dark:bg-gray-700/20 dark:border-gray-700 opacity-60'
        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
    }`}>

      {/* שעה + צבע */}
      <div className="flex items-center sm:flex-col sm:items-center gap-3 sm:gap-1
                      sm:w-24 shrink-0 text-center
                      border-b sm:border-b-0 sm:border-l
                      border-gray-100 dark:border-gray-700
                      pb-3 sm:pb-0 sm:pl-4">
        <div className="w-3 h-3 rounded-full shadow-inner sm:mb-1 shrink-0"
             style={{ backgroundColor: apt.color || '#e5007e' }} />
        <div>
          <span className="text-xl font-bold text-gray-900 dark:text-white leading-none">
            {apt.startTime}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400
                           flex items-center justify-center gap-1 mt-1">
            <Clock className="w-3 h-3" /> עד {apt.endTime}
          </span>
        </div>
      </div>

      {/* פרטים */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
              {apt.title}
            </h3>
            {apt.price > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold
                               text-emerald-600 dark:text-emerald-400
                               bg-emerald-50 dark:bg-emerald-900/20
                               px-2 py-0.5 rounded-md shrink-0">
                <Wallet className="w-3 h-3" />
                ₪{Number(apt.price).toLocaleString('he-IL')}
              </span>
            )}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full
                            font-semibold shrink-0 ${meta.cls}`}>
            {meta.label}
          </span>
        </div>
        <p className="flex items-center gap-1.5 mt-2 text-sm text-gray-600 dark:text-gray-400">
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
      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center
                      border-t sm:border-t-0 border-gray-100 dark:border-gray-700
                      pt-3 sm:pt-0 w-full sm:w-auto justify-end">
        {apt.status === 'scheduled' && (
          <button onClick={() => onCompleteClick(apt)}
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

// ── WeekView ───────────────────────────────────────────────────────────────

function WeekView({ weekDays, getByDate, onDayClick, selectedDate, onAddForDay }) {
  const today = toDateStr(new Date());

  return (
    <div className="grid grid-cols-7 gap-1 md:gap-2">
      {weekDays.map((day) => {
        const dateStr = toDateStr(day);
        const apts    = getByDate(dateStr);
        const isToday = dateStr === today;
        const isSel   = dateStr === selectedDate;

        return (
          <div key={dateStr}
            onClick={() => onDayClick(day)}
            className={`min-h-[110px] md:min-h-[140px] rounded-xl border p-1.5 md:p-2
                        cursor-pointer transition-all group ${
              isSel
                ? 'border-[#e5007e] bg-pink-50/50 dark:bg-[#e5007e]/10 shadow-sm'
                : isToday
                ? 'border-blue-300 bg-blue-50/40 dark:bg-blue-900/10 dark:border-blue-700/40'
                : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-pink-200 dark:hover:border-pink-800/40 hover:shadow-sm'
            }`}>

            {/* ראש היום */}
            <div className="flex flex-col items-center mb-2">
              <span className={`text-xs font-bold rounded-full w-6 h-6
                                flex items-center justify-center transition-colors ${
                isToday
                  ? 'bg-blue-500 text-white'
                  : isSel
                  ? 'bg-[#e5007e] text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}>
                {day.getDate()}
              </span>
              {apts.length > 0 && (
                <span className="text-[9px] text-gray-400 mt-0.5">
                  {apts.length} תורים
                </span>
              )}
            </div>

            {/* תורים */}
            <div className="space-y-0.5">
              {apts.slice(0, 3).map((apt) => (
                <div key={apt.id}
                  className="text-[10px] truncate px-1.5 py-0.5 rounded-md font-medium leading-tight"
                  style={{
                    backgroundColor: `${apt.color || '#e5007e'}18`,
                    color:           apt.color || '#e5007e',
                    borderRight:     `2px solid ${apt.color || '#e5007e'}`,
                  }}>
                  {apt.startTime} {apt.title}
                </div>
              ))}
              {apts.length > 3 && (
                <div className="text-[9px] text-gray-400 text-center pt-0.5">
                  +{apts.length - 3} עוד
                </div>
              )}
            </div>

            {/* כפתור + */}
            {apts.length === 0 && (
              <div className="flex items-center justify-center mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onAddForDay(day); }}
                  className="w-6 h-6 rounded-full border border-dashed border-gray-200
                             dark:border-gray-600 text-gray-300 dark:text-gray-600
                             group-hover:border-[#e5007e] group-hover:text-[#e5007e]
                             transition-colors flex items-center justify-center">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main: Calendar ─────────────────────────────────────────────────────────

export default function Calendar() {
  const {
    loading: apptLoading, error,
    getByDate, addAppointment, updateAppointment, deleteAppointment, stats,
  } = useAppointments();
  const { loading: srvLoading } = useServices();
  const { addTransaction }      = useTransactions('income');
  const { showToast }           = useToast();

  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [viewMode,     setViewMode]     = useState('day');
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingApt,   setEditingApt]   = useState(null);
  const [deletingApt,  setDeletingApt]  = useState(null);
  const [chargingApt,  setChargingApt]  = useState(null);
  const listRef = useRef(null);

  const loading = apptLoading || srvLoading;

  const dateString        = useMemo(() => toDateStr(currentDate), [currentDate]);
  const dailyAppointments = getByDate(dateString);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDays  = useMemo(() => getWeekDays(weekStart),    [weekStart]);

  // ── אנימציה ────────────────────────────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'day' || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-apt]');
    if (!items.length) return;
    gsap.fromTo(items,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.3, stagger: 0.06,
        ease: 'power2.out', clearProps: 'all' }
    );
  }, [dateString, dailyAppointments.length, viewMode]);

  // ── ניווט ──────────────────────────────────────────────────────────
  const navigate = (delta) => {
    const d = new Date(currentDate);
    viewMode === 'day'
      ? d.setDate(d.getDate() + delta)
      : d.setDate(d.getDate() + delta * 7);
    setCurrentDate(d);
  };

  // ── שמירת תור ─────────────────────────────────────────────────────
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

  // ── מחיקה ─────────────────────────────────────────────────────────
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

  // ── שינוי סטטוס ───────────────────────────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAppointment(id, { status: newStatus });
      showToast('סטטוס עודכן ✓', 'success');
    } catch {
      showToast('שגיאה בעדכון', 'error');
    }
  };

  // ── השלמת תור ─────────────────────────────────────────────────────
  const handleCompleteClick = (apt) => {
    if (apt.price && apt.price > 0) {
      setChargingApt(apt);
    } else {
      handleStatusChange(apt.id, 'completed');
    }
  };

  // ── אוטומציה פיננסית ──────────────────────────────────────────────
  const handleConfirmCharge = async (apt) => {
    try {
      await addTransaction({
        amount:   Number(apt.price),
        category: 'טיפולים',
        source:   apt.customerName || 'לקוחה מהיומן',
        date:     toDateStr(new Date()),
        notes:    `תור אוטומטי: ${apt.title}`,
      });
      await updateAppointment(apt.id, { status: 'completed' });
      showToast(`₪${apt.price} נוספו להכנסות 💰`, 'success');
    } catch (err) {
      console.error('[ChargeModal]', err);
      showToast('שגיאה בשמירת ההכנסה', 'error');
    } finally {
      setChargingApt(null);
    }
  };

  // ── פתיחת modal ───────────────────────────────────────────────────
  const openAdd       = ()    => { setEditingApt(null); setIsModalOpen(true); };
  const openAddForDay = (day) => { setCurrentDate(day); setEditingApt(null); setIsModalOpen(true); };
  const openEdit      = (apt) => { setEditingApt(apt);  setIsModalOpen(true); };
  const handleModalClose = () => { setIsModalOpen(false); setEditingApt(null); };

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent
                      rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">

      {/* ── Stats ──────────────────────────────────────────────────── */}
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

      {/* ── Navigation + View Toggle ────────────────────────────────── */}
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
          <button onClick={() => navigate(-1)}
            className="p-2 text-gray-500 hover:text-[#e5007e] hover:bg-pink-50
                       dark:hover:bg-gray-700 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="relative text-center min-w-[190px] group cursor-pointer">
            <div className="flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center gap-2
                              text-gray-900 dark:text-white
                              group-hover:text-[#e5007e] transition-colors">
                <CalendarIcon className="w-5 h-5 text-[#e5007e]" />
                <h2 className="text-base font-bold">
                  {viewMode === 'day'
                    ? currentDate.toLocaleDateString('he-IL', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })
                    : `${weekDays[0].toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  }
                </h2>
                {viewMode === 'day' && (
                  <input type="date"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    value={dateString}
                    onChange={(e) => {
                      if (e.target.value) setCurrentDate(fromDateStr(e.target.value));
                    }}
                  />
                )}
              </div>
              {viewMode === 'day' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  יום {HE_DAYS[currentDate.getDay()]}
                </p>
              )}
            </div>
          </div>

          <button onClick={() => navigate(1)}
            className="p-2 text-gray-500 hover:text-[#e5007e] hover:bg-pink-50
                       dark:hover:bg-gray-700 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 text-sm font-semibold text-[#e5007e]
                       bg-pink-50 dark:bg-[#e5007e]/10 rounded-xl
                       hover:bg-pink-100 dark:hover:bg-[#e5007e]/20 transition-colors">
            היום
          </button>

          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 gap-1">
            <button onClick={() => setViewMode('day')} title="תצוגה יומית"
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-gray-600 text-[#e5007e] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}>
              <LayoutList className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('week')} title="תצוגה שבועית"
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-gray-600 text-[#e5007e] shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}>
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600
                        dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── תצוגה שבועית ───────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm
                        border border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-3">
            {weekDays.map((day) => (
              <div key={day.toISOString()}
                className="text-center text-[11px] text-gray-400 dark:text-gray-500
                           font-semibold py-1">
                {HE_DAYS_SHORT[day.getDay()]}
              </div>
            ))}
          </div>
          <WeekView
            weekDays={weekDays}
            getByDate={getByDate}
            onDayClick={(day) => { setCurrentDate(day); setViewMode('day'); }}
            selectedDate={dateString}
            onAddForDay={openAddForDay}
          />
        </div>
      )}

      {/* ── תצוגה יומית ────────────────────────────────────────────── */}
      {viewMode === 'day' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm
                        border border-gray-100 dark:border-gray-700 min-h-[400px]">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-gray-800 dark:text-white">
              תורים ליום זה
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50
                             dark:bg-gray-700 px-3 py-1 rounded-full">
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
                <div key={apt.id} data-apt>
                  <AppointmentCard
                    apt={apt}
                    onEdit={openEdit}
                    onDelete={setDeletingApt}
                    onCompleteClick={handleCompleteClick}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
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
      <ChargeModal
        isOpen={!!chargingApt}
        appointment={chargingApt}
        onConfirmWithCharge={handleConfirmCharge}
        onConfirmWithoutCharge={(apt) => {
          handleStatusChange(apt.id, 'completed');
          setChargingApt(null);
        }}
        onCancel={() => setChargingApt(null)}
      />
    </div>
  );
}
