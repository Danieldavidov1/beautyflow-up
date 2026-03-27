// src/components/dashboard/Calendar.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAppointments }      from '../../hooks/useAppointments';
import { useCustomers }         from '../../hooks/useCustomers';
import { useServices }          from '../../hooks/useServices';
import { useTransactions }      from '../../hooks/useTransactions';
import { useBusinessSettings }  from '../../hooks/useBusinessSettings';
import { useToast }             from '../../context/ToastContext';
import {
  ChevronRight, ChevronLeft, Calendar as CalendarIcon,
  Plus, Clock, User, UserPlus, X, Trash2, CheckCircle,
  AlertCircle, Edit, Search, Tag, Wallet, Check,
  LayoutList, CalendarDays, Minus, AlertTriangle, Lock,
  ExternalLink, Phone, FileText,
} from 'lucide-react';
import gsap from 'gsap';
import CalendarView from './CalendarView';

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

function checkTimeInBusinessHours(businessHours, closedDays = [], date, startTime, endTime) {
  if (!date || !startTime || !endTime || !businessHours) return { allowed: true };
  if (closedDays.includes(date)) return { allowed: false, reason: 'יום חופשה / סגור' };
  const dayIndex = new Date(date + 'T12:00:00').getDay();
  const cfg = businessHours[dayIndex];
  if (!cfg || !cfg.isActive) return { allowed: false, reason: `יום ${HE_DAYS[dayIndex]} — העסק סגור` };
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  if (toMin(startTime) < toMin(cfg.start)) return { allowed: false, reason: `לפני שעת הפתיחה (${cfg.start})` };
  if (toMin(endTime) > toMin(cfg.end)) return { allowed: false, reason: `אחרי שעת הסגירה (${cfg.end})` };
  return { allowed: true };
}

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const inputCls = `w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600
  bg-gray-50 dark:bg-gray-700 dark:text-white text-sm outline-none
  focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all`;

const STATUS_META = {
  scheduled: { label: 'מתוכנן', cls: 'bg-blue-50  text-blue-600  dark:bg-blue-900/20  dark:text-blue-400'  },
  completed:  { label: 'הושלם',  cls: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
  cancelled:  { label: 'בוטל',   cls: 'bg-gray-100 text-gray-500  dark:bg-gray-700     dark:text-gray-400'  },
  blocked:    { label: 'חסום',   cls: 'bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400' },
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
  notes:      '',
};

// ── BlockTimeModal ─────────────────────────────────────────────────────────
function BlockTimeModal({ isOpen, onClose, onSave, selectedDate }) {
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);
  const { showToast } = useToast();
  const [form, setForm] = useState({ date: selectedDate ?? toDateStr(new Date()), startTime: '13:00', endTime: '14:00', reason: '', isAllDay: false });
  const [saving, setSaving] = useState(false);
  const QUICK_REASONS = ['🍽️ ארוחת צהריים', '🧒 איסוף ילדים', '☕ הפסקה', '🏥 רופא', '🚗 פגישה', '🏖️ חופש'];

  useEffect(() => { if (isOpen) setForm(p => ({ ...p, date: selectedDate ?? toDateStr(new Date()) })); }, [isOpen, selectedDate]);
  useEffect(() => {
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current, { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' });
  }, [isOpen]);

  const handleClose = () => {
    if (!modalRef.current || !overlayRef.current) { onClose(); return; }
    gsap.to(modalRef.current, { opacity: 0, y: 20, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { showToast('יש לבחור תאריך', 'error'); return; }
    if (!form.isAllDay && form.endTime <= form.startTime) { showToast('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error'); return; }
    setSaving(true);
    try {
      await onSave({
        title: form.reason || '🔒 זמן חסום', date: form.date, startTime: form.isAllDay ? '00:00' : form.startTime,
        endTime: form.isAllDay ? '23:59' : form.endTime, status: 'blocked', color: '#f97316', price: 0,
        customerId: '__blocked__', customerName: 'זמן חסום', isBlocked: true,
      });
      handleClose();
    } catch { showToast('שגיאה בשמירת חסימה', 'error'); } finally { setSaving(false); }
  };

  if (!isOpen) return null;
  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }} dir="rtl">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md my-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-orange-50 dark:bg-orange-900/20">
          <div className="flex items-center gap-2"><div className="p-2 bg-orange-100 dark:bg-orange-800/40 rounded-xl"><Lock className="w-4 h-4 text-orange-500" /></div><div><h2 className="text-lg font-bold text-gray-800 dark:text-white">חסימת זמן ביומן</h2><p className="text-xs text-gray-500 dark:text-gray-400">מניעת קביעת תורים בשעות אלו</p></div></div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-orange-500 rounded-full hover:bg-orange-100 dark:hover:bg-gray-700 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div><label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">סיבת החסימה</label><div className="flex flex-wrap gap-2 mb-3">{QUICK_REASONS.map((r) => (<button key={r} type="button" onClick={() => setForm(p => ({ ...p, reason: r }))} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${form.reason === r ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-700'}`}>{r}</button>))}</div><input type="text" placeholder="או הקלידי סיבה אחרת..." value={form.reason} onChange={(e) => setForm(p => ({ ...p, reason: e.target.value }))} className={inputCls} /></div>
          <div><label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">תאריך <span className="text-orange-500">*</span></label><input required type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} className={inputCls} /></div>
          <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
            <div className={`w-10 h-5 rounded-full transition-all relative ${form.isAllDay ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`} onClick={() => setForm(p => ({ ...p, isAllDay: !p.isAllDay }))}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isAllDay ? 'right-0.5' : 'left-0.5'}`} /></div>
            <div><p className="text-sm font-semibold text-gray-700 dark:text-gray-200">חסום את כל היום</p><p className="text-xs text-gray-400">יום חופש / אין עבודה</p></div>
          </label>
          {!form.isAllDay && (<div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">משעה <span className="text-orange-500">*</span></label><input required type="time" value={form.startTime} onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))} className={inputCls} /></div><div><label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">עד שעה <span className="text-orange-500">*</span></label><input required type="time" value={form.endTime} onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))} className={inputCls} /></div></div>)}
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800/50"><p className="text-xs text-orange-700 dark:text-orange-400 font-semibold mb-1">🔒 תצוגה מקדימה</p><p className="text-sm text-orange-800 dark:text-orange-300 font-medium">{form.reason || 'זמן חסום'} — {form.isAllDay ? 'כל היום' : `${form.startTime} עד ${form.endTime}`}</p></div>
          <div className="flex gap-3 pt-1"><button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">ביטול</button><button type="submit" disabled={saving} className="flex-[2] py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"><Lock className="w-4 h-4" />{saving ? 'שומר...' : 'חסום זמן'}</button></div>
        </form>
      </div>
    </div>
  );
}

// ── ServiceSelector ────────────────────────────────────────────────────────
function ServiceSelector({ activeServices, selectedServices, onChange, startTime }) {
  const addService = (serviceId) => {
    if (!serviceId || serviceId === 'placeholder') return;
    if (serviceId === 'custom') { onChange(selectedServices, true); return; }
    const service = activeServices.find((s) => s.id === serviceId);
    if (!service) return;
    const existing = selectedServices.findIndex((s) => s.serviceId === serviceId);
    if (existing >= 0) {
      const updated = [...selectedServices];
      updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 };
      onChange(updated);
    } else {
      onChange([...selectedServices, { serviceId: service.id, title: service.title, price: Number(service.price), color: service.color ?? '#e5007e', duration: Number(service.duration), qty: 1 }]);
    }
  };

  const changeQty = (serviceId, delta) => {
    const updated = selectedServices.map((s) => s.serviceId === serviceId ? { ...s, qty: s.qty + delta } : s).filter((s) => s.qty > 0);
    onChange(updated);
  };

  const removeService = (serviceId) => onChange(selectedServices.filter((s) => s.serviceId !== serviceId));
  const totalPrice    = selectedServices.reduce((sum, s) => sum + s.price * s.qty, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration * s.qty, 0);
  const endTime       = totalDuration > 0 ? addMinutesToTime(startTime, totalDuration) : null;

  return (
    <div className="space-y-3">
      {selectedServices.length > 0 && (
        <div className="space-y-2">
          {selectedServices.map((s) => (
            <div key={s.serviceId} className="flex items-center gap-2 p-2.5 rounded-xl bg-pink-50 dark:bg-[#e5007e]/10 border border-pink-100 dark:border-[#e5007e]/20 group transition-all">
              <button type="button" onClick={() => removeService(s.serviceId)} title="הסר שירות" className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-gray-300 hover:text-white hover:bg-red-400 dark:text-gray-600 dark:hover:bg-red-500 transition-all duration-150"><X className="w-3 h-3" /></button>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm font-medium text-gray-800 dark:text-white flex-1 truncate">{s.title}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{s.duration * s.qty} דק׳</span>
              <div className="flex items-center gap-1 shrink-0"><button type="button" onClick={() => changeQty(s.serviceId, -1)} className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors"><Minus className="w-3 h-3" /></button><span className="text-sm font-bold text-gray-800 dark:text-white w-5 text-center">{s.qty}</span><button type="button" onClick={() => changeQty(s.serviceId, 1)} className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-[#e5007e] flex items-center justify-center transition-colors"><Plus className="w-3 h-3" /></button></div>
              <span className="text-sm font-bold text-[#e5007e] shrink-0 min-w-[52px] text-left">₪{(s.price * s.qty).toLocaleString('he-IL')}</span>
            </div>
          ))}
        </div>
      )}
      <select value="placeholder" onChange={(e) => addService(e.target.value)} className={inputCls}>
        <option value="placeholder">{selectedServices.length === 0 ? '+ בחרי טיפול מהמחירון...' : '+ הוסיפי טיפול נוסף'}</option>
        {activeServices.length === 0 && <option value="" disabled>— אין שירותים מוגדרים —</option>}
        {activeServices.map((s) => (<option key={s.id} value={s.id}>{s.title} · {s.duration} דק׳ · ₪{Number(s.price).toLocaleString('he-IL')}</option>))}
        <option value="custom">— טיפול מותאם אישית / אחר —</option>
      </select>
      {selectedServices.length > 0 && (
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 px-1 pt-0.5">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{totalDuration} דק׳{endTime ? ` · יסתיים ב-${endTime}` : ''}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">סה״כ: ₪{totalPrice.toLocaleString('he-IL')}</span>
        </div>
      )}
      {activeServices.length === 0 && (
        <p className="text-[11px] text-amber-500 pr-1">
          💡 פתחי &quot;שירותים ומחירון&quot; כדי להוסיף טיפולים
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
  useEffect(() => { if (!isOpen) { setSearch(selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}` : ''); } }, [value, isOpen, selectedCustomer]);
  useEffect(() => { function onClickOutside(e) { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) { setIsOpen(false); if (!selectedCustomer) onChange(''); } } document.addEventListener('mousedown', onClickOutside); return () => document.removeEventListener('mousedown', onClickOutside); }, [selectedCustomer, onChange]);
  const filtered = useMemo(() => customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)), [customers, search]);
  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" /><input type="text" className={`${inputCls} pr-9`} placeholder="חפשי לקוחה לפי שם או טלפון..." value={search} onChange={(e) => { setSearch(e.target.value); setIsOpen(true); if (!e.target.value) onChange(''); }} onClick={() => { setSearch(''); setIsOpen(true); }} /></div>
      {isOpen && (<ul className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl">{filtered.length === 0 ? (<li className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">לא נמצאו לקוחות</li>) : (filtered.map((c) => (<li key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c.id); setIsOpen(false); }} className="p-3 text-sm hover:bg-pink-50 dark:hover:bg-gray-700 cursor-pointer dark:text-white flex justify-between items-center transition-colors"><span className="font-medium">{c.name}</span><span className="text-gray-400 text-xs" dir="ltr">{c.phone}</span></li>)))}</ul>)}
    </div>
  );
}

// ── DeleteAppointmentModal ─────────────────────────────────────────────────
function DeleteAppointmentModal({ isOpen, appointmentTitle, onConfirm, onCancel }) {
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current, { opacity: 0, scale: 0.92, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)' });
  }, [isOpen]);

  useEffect(() => { if (isOpen) setReason(''); }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">מחיקת תור</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">למחוק את התור <span className="font-semibold text-gray-700 dark:text-gray-200">&quot;{appointmentTitle}&quot;</span>? פעולה זו אינה ניתנת לביטול.</p>
          </div>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="סיבת ביטול/מחיקה (תישמר בכרטיס לקוח)..."
          className="w-full mt-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white text-sm resize-none"
          rows={2}
        />
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">ביטול</button>
          <button onClick={() => onConfirm(reason)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">מחק תור</button>
        </div>
      </div>
    </div>
  );
}

// ── ChargeModal ────────────────────────────────────────────────────────────
function ChargeModal({ isOpen, appointment, onConfirmWithCharge, onConfirmWithoutCharge, onCancel }) {
  const overlayRef = useRef(null); const modalRef = useRef(null);
  useEffect(() => { if (!isOpen || !overlayRef.current || !modalRef.current) return; gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }); gsap.fromTo(modalRef.current, { opacity: 0, scale: 0.92, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)' }); }, [isOpen]);
  if (!isOpen || !appointment) return null;
  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" dir="rtl">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 flex flex-col items-center text-center border-b border-emerald-100 dark:border-emerald-800/50"><div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-400 shadow-inner"><Check size={28} strokeWidth={3} /></div><h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">הטיפול הסתיים! 🎉</h3><p className="text-sm text-gray-600 dark:text-gray-300">האם תרצי להוסיף את התשלום של <span className="font-bold text-gray-900 dark:text-white">{appointment.customerName}</span> להכנסות?</p></div>
        <div className="p-6"><div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-5"><div className="flex items-center gap-2 text-gray-700 dark:text-gray-200"><Tag size={16} className="text-[#e5007e]" /><span className="font-medium text-sm">{appointment.title}</span></div><div className="font-bold text-xl text-emerald-600 dark:text-emerald-400">₪{Number(appointment.price).toLocaleString('he-IL')}</div></div><div className="space-y-3"><button onClick={() => onConfirmWithCharge(appointment)} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20"><Wallet size={18} /> הוסף הכנסה וסמן כהושלם</button><button onClick={() => onConfirmWithoutCharge(appointment)} className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm">רק סמן כהושלם (ללא הכנסה)</button></div></div>
      </div>
    </div>
  );
}

// ── NotesAccordion ─────────────────────────────────────────────────────────
// ✅ Updated: always collapsed by default, pink dot badge, optional readOnly mode
function NotesAccordion({ value, onChange, readOnly = false }) {
  const hasContent = value && value.trim().length > 0;
  const [isOpen, setIsOpen] = useState(false); // ✅ always start collapsed
  const contentRef  = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!contentRef.current) return;
    if (isOpen) {
      gsap.fromTo(
        contentRef.current,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.28, ease: 'power2.out',
          onComplete: () => { if (!readOnly) textareaRef.current?.focus(); } }
      );
    } else {
      gsap.to(contentRef.current, {
        height: 0, opacity: 0, duration: 0.22, ease: 'power2.in',
      });
    }
  }, [isOpen, readOnly]);

  // If readOnly and no content, nothing to show
  if (readOnly && !hasContent) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-400
                   hover:text-[#e5007e] transition-colors group"
      >
        <FileText className="w-3.5 h-3.5 group-hover:text-[#e5007e] transition-colors" />
        <span>
          {isOpen
            ? 'הסתר הערות'
            : hasContent
              ? readOnly ? '📝 הצג הערות' : '📝 יש הערה לתור'
              : '➕ הוסף הערות (אופציונלי)'}
        </span>
        {/* ✅ Pink dot badge — visible when collapsed and has content */}
        {hasContent && !isOpen && (
          <span className="w-2 h-2 rounded-full bg-[#e5007e] shrink-0 animate-pulse" />
        )}
      </button>

      <div ref={contentRef} style={{ height: 0, overflow: 'hidden', opacity: 0 }}>
        {readOnly ? (
          <p className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm
                        text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {value}
          </p>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="הערות לתור — חומרים, רגישויות, דגשים..."
            rows={3}
            className={`${inputCls} resize-none mt-2`}
          />
        )}
      </div>
    </div>
  );
}

// ── AppointmentModal ───────────────────────────────────────────────────────
function AppointmentModal({
  isOpen, onClose, onSave, selectedDate, initialData,
  businessHours, closedDays, setCurrentPage,
  onCompleteClick, onDeleteClick, onCancelClick,
}) {
  const { customers, addCustomer } = useCustomers();
  const { activeServices }         = useServices();
  const { showToast }              = useToast();

  const overlayRef = useRef(null);
  const modalRef   = useRef(null);

  // ── Core form state ────────────────────────────────────────────────
  const [saving,              setSaving]              = useState(false);
  const [formData,            setFormData]            = useState(EMPTY_FORM);
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustomer,         setNewCustomer]         = useState({ name: '', phone: '' });
  const [savingNewCustomer,   setSavingNewCustomer]   = useState(false);
  const [customTitle,         setCustomTitle]         = useState('');
  const [showCustomInput,     setShowCustomInput]     = useState(false);

  // ── View/Edit mode + Cancel panel ─────────────────────────────────
  const [mode,            setMode]           = useState('edit'); // 'view' | 'edit'
  const [showCancelPanel, setShowCancelPanel] = useState(false);
  const [cancelReason,    setCancelReason]   = useState('');
  const [cancelling,      setCancelling]     = useState(false);

  const isEditing = !!initialData?.id;

  // ── Business hours check ───────────────────────────────────────────
  const businessHoursCheck = useMemo(() => {
    if (!businessHours || !formData.date || !formData.startTime || !formData.endTime) return { allowed: true };
    return checkTimeInBusinessHours(businessHours, closedDays ?? [], formData.date, formData.startTime, formData.endTime);
  }, [businessHours, closedDays, formData.date, formData.startTime, formData.endTime]);

  // ── Derived view-mode data ─────────────────────────────────────────
  // Change 4: handles BOTH services[] array (online booking) and single serviceId (manual)
  const viewServices = useMemo(() => {
    if (formData.services && formData.services.length > 0) {
      return formData.services.map((s) => ({
        ...s,
        qty:      Number(s.qty)      || 1,
        price:    Number(s.price)    || 0,
        duration: Number(s.duration) || 0,
        color:    s.color            || '#e5007e',
      }));
    }
    // Fall back to single serviceId / serviceTitle fields
    if (formData.serviceTitle || formData.title) {
      return [{
        serviceId: formData.serviceId || 'custom',
        title:     formData.serviceTitle || formData.title || 'טיפול',
        price:     Number(formData.price)    || 0,
        duration:  Number(formData.duration) || 0,
        qty:       1,
        color:     formData.color || '#e5007e',
      }];
    }
    return [];
  }, [formData]);

  const viewCustomer   = useMemo(() => customers.find((c) => c.id === formData.customerId), [customers, formData.customerId]);
  const totalDuration  = useMemo(() => viewServices.reduce((sum, s) => sum + s.duration * s.qty, 0), [viewServices]);
  const totalPrice     = useMemo(() => viewServices.reduce((sum, s) => sum + s.price * s.qty, 0), [viewServices]);
  const displayDate    = useMemo(() => {
    if (!formData.date) return '';
    return new Date(formData.date + 'T12:00:00').toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }, [formData.date]);

  // ── Load data on open ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (initialData && initialData.id) {
      // Change 4: load services array if present, otherwise fall back to single serviceId
      let loadedServices = initialData.services && initialData.services.length > 0
        ? initialData.services
        : [];
      loadedServices = loadedServices.map((s) => ({
        ...s,
        qty:      Number(s.qty)      || 1,
        price:    Number(s.price)    || 0,
        duration: Number(s.duration) || 0,
        color:    s.color            || '#e5007e',
      }));
      if (loadedServices.length === 0 && (initialData.serviceId || initialData.treatmentId)) {
        loadedServices = [{
          serviceId: initialData.serviceId || initialData.treatmentId || 'custom',
          title:     initialData.serviceTitle || initialData.treatmentName || initialData.title || 'טיפול',
          price:     Number(initialData.price)    || 0,
          color:     initialData.color            || '#e5007e',
          duration:  Number(initialData.duration) || 60,
          qty:       1,
        }];
      }
      setFormData({ ...EMPTY_FORM, ...initialData, services: loadedServices });
      if (loadedServices.length === 0 && initialData.title) {
        setCustomTitle(initialData.title); setShowCustomInput(true);
      } else {
        setCustomTitle(''); setShowCustomInput(false);
      }
      setMode('view'); // ✅ Change 1: existing → view card first
    } else if (initialData && !initialData.id) {
      setFormData({ ...EMPTY_FORM, date: initialData.date, startTime: initialData.startTime, endTime: initialData.endTime });
      setCustomTitle(''); setShowCustomInput(false);
      setMode('edit'); // new appointment → edit directly
    } else {
      setFormData({ ...EMPTY_FORM, date: selectedDate ?? toDateStr(new Date()) });
      setCustomTitle(''); setShowCustomInput(false);
      setMode('edit');
    }
    setSaving(false);
    setIsAddingNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
    setShowCancelPanel(false);
    setCancelReason('');
  }, [isOpen, initialData, selectedDate]);

  // ── GSAP open animation ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current, { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' });
  }, [isOpen]);

  const handleClose = () => {
    if (!modalRef.current || !overlayRef.current) { onClose(); return; }
    gsap.to(modalRef.current,   { opacity: 0, y: 20, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const set = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  const handleServicesChange = useCallback((newServices, isCustom = false) => {
    if (isCustom) { setShowCustomInput(true); return; }
    const totalDur  = newServices.reduce((sum, s) => sum + s.duration * s.qty, 0);
    const totalPrc  = newServices.reduce((sum, s) => sum + s.price * s.qty, 0);
    const titles    = newServices.map((s) => s.qty > 1 ? `${s.title} x${s.qty}` : s.title);
    const firstColor = newServices[0]?.color ?? '#e5007e';
    setFormData((p) => ({
      ...p, services: newServices, title: titles.join(' + ') || '', price: totalPrc,
      color: firstColor, endTime: totalDur > 0 ? addMinutesToTime(p.startTime, totalDur) : p.endTime,
    }));
    if (newServices.length > 0) { setShowCustomInput(false); setCustomTitle(''); }
  }, []);

  const handleQuickAddCustomer = async () => {
    const name  = newCustomer.name.trim();
    const phone = newCustomer.phone.trim();
    if (!name) { showToast('חובה להזין שם לקוחה', 'error'); return; }
    setSavingNewCustomer(true);
    try {
      const newId = await addCustomer({ name, phone });
      set('customerId', newId); setIsAddingNewCustomer(false); setNewCustomer({ name: '', phone: '' });
      showToast(`"${name}" נוספה ונבחרה! 🎉`, 'success');
    } catch { showToast('שגיאה בשמירת הלקוחה', 'error'); } finally { setSavingNewCustomer(false); }
  };

  const handleStartTimeChange = (newStartTime) => {
    setFormData((p) => {
      const dur = p.services.reduce((sum, s) => sum + s.duration * s.qty, 0);
      return { ...p, startTime: newStartTime, endTime: dur > 0 ? addMinutesToTime(newStartTime, dur) : p.endTime };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const hasValidServices = formData.services.length > 0 || (showCustomInput && customTitle.trim() !== '');
    if (!formData.customerId)  { showToast('יש לבחור לקוחה', 'error'); return; }
    if (!hasValidServices)     { showToast('יש לבחור לפחות טיפול אחד', 'error'); return; }
    if (formData.endTime <= formData.startTime) { showToast('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error'); return; }
    if (!businessHoursCheck.allowed) showToast(`⚠️ התור מחוץ לשעות הפעילות: ${businessHoursCheck.reason}`, 'warning');
    setSaving(true);
    const customer = customers.find((c) => c.id === formData.customerId);
    let finalTitle = showCustomInput ? customTitle.trim() : formData.title.trim();
    if (!finalTitle) {
      finalTitle = formData.services.length > 0
        ? formData.services.map((s) => s.qty > 1 ? `${s.title} x${s.qty}` : s.title).join(' + ')
        : `תור ${formData.date}`;
    }
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

  // ✅ Change 2: cancel handler — calls parent's onCancelClick(apt, reason)
  const handleCancelAppointment = async () => {
    if (!formData.id || !onCancelClick) return;
    setCancelling(true);
    try {
      await onCancelClick(formData, cancelReason.trim());
      handleClose();
    } catch {
      showToast('שגיאה בביטול התור', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleNavigateToCustomer = () => {
    if (!formData.customerId || !setCurrentPage) return;
    handleClose();
    setCurrentPage('customers', { id: formData.customerId });
  };

  if (!isOpen) return null;

  const hasValidServices = formData.services.length > 0 || (showCustomInput && customTitle.trim() !== '');
  const canSubmit        = formData.customerId && hasValidServices && !saving;
  const isCancelledOrCompleted = formData.status === 'cancelled' || formData.status === 'completed';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      dir="rtl"
    >
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md my-4 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {!isEditing ? 'תור חדש ✨' : mode === 'view' ? 'פרטי תור' : 'עריכת תור ✏️'}
          </h2>
          <div className="flex items-center gap-1">
            {isEditing && (
              <button
                type="button"
                onClick={() => { onDeleteClick(formData); handleClose(); }}
                title="מחק תור"
                className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={handleClose} className="p-2 text-gray-400 hover:text-[#e5007e] rounded-full hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Navigate to customer card (always visible when editing) ── */}
        {isEditing && formData.customerId && (
          <div className="px-6 pt-4 pb-0">
            <button
              type="button"
              onClick={handleNavigateToCustomer}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                         bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                         border border-blue-100 dark:border-blue-800/50
                         rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40
                         transition-colors text-sm font-semibold"
            >
              <User className="w-4 h-4" />
              👤 פתח כרטיס לקוח
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            CHANGE 1: VIEW MODE — Read-Only Card
        ════════════════════════════════════════════════════════════════ */}
        {isEditing && mode === 'view' && (
          <div className="p-6 max-h-[70vh] overflow-y-auto">

            {/* Customer name + phone + status */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {viewCustomer?.name || formData.customerName || 'לקוחה לא ידועה'}
                </h3>
                {(viewCustomer?.phone || formData.customerPhone) && (
                  <a
                    href={`tel:${viewCustomer?.phone || formData.customerPhone}`}
                    className="text-sm text-[#e5007e] font-medium flex items-center gap-1 mt-1 hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span dir="ltr">{viewCustomer?.phone || formData.customerPhone}</span>
                  </a>
                )}
              </div>
              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 ${STATUS_META[formData.status]?.cls ?? ''}`}>
                {STATUS_META[formData.status]?.label ?? formData.status}
              </span>
            </div>

            {/* Services list — handles BOTH services[] and single serviceId (Change 4) */}
            <div className="space-y-2 mb-4">
              {viewServices.length > 0 ? (
                viewServices.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-pink-50 dark:bg-[#e5007e]/10 border border-pink-100 dark:border-[#e5007e]/20">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color || '#e5007e' }} />
                    <span className="text-sm font-medium text-gray-800 dark:text-white flex-1">
                      {s.title}{s.qty > 1 ? ` x${s.qty}` : ''}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {s.duration * s.qty} דק׳
                    </span>
                    <span className="text-sm font-bold text-[#e5007e] shrink-0 min-w-[52px] text-left">
                      ₪{(s.price * s.qty).toLocaleString('he-IL')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">אין טיפולים רשומים</p>
              )}

              {/* Total row */}
              {viewServices.length > 1 && (
                <div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 px-1 pt-1.5 border-t border-gray-100 dark:border-gray-700 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> סה״כ {totalDuration} דק׳
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ₪{totalPrice.toLocaleString('he-IL')}
                  </span>
                </div>
              )}
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <CalendarIcon className="w-4 h-4 text-[#e5007e] shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-200 leading-tight">{displayDate}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <Clock className="w-4 h-4 text-[#e5007e] shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {formData.startTime} – {formData.endTime}
                </span>
              </div>
            </div>

            {/* Change 3: Notes — collapsed by default, read-only in view mode */}
            <div className="mb-4">
              <NotesAccordion
                value={formData.notes || ''}
                onChange={() => {}} // no-op in read-only
                readOnly
              />
            </div>

            {/* Change 2: Cancellation panel OR action buttons */}
            {showCancelPanel ? (
              <div className="mt-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-2xl">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                  🚫 ביטול תור
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="סיבת ביטול (אופציונלי)..."
                  className="w-full p-2.5 rounded-xl border border-red-200 dark:border-red-700
                             bg-white dark:bg-gray-800 text-sm resize-none
                             focus:outline-none focus:ring-1 focus:ring-red-400
                             dark:text-white placeholder-gray-400"
                />
                <p className="text-right text-[11px] text-gray-400 mb-2">{cancelReason.length}/200</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowCancelPanel(false); setCancelReason(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                               text-sm font-medium text-gray-600 dark:text-gray-300
                               hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAppointment}
                    disabled={cancelling}
                    className="flex-[2] py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                               text-white text-sm font-bold transition-colors
                               disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {cancelling
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> מבטל...</>
                      : '✅ אשר ביטול'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-2">
                {/* Complete + payment button */}
                {!isCancelledOrCompleted && (
                  <button
                    type="button"
                    onClick={() => { onCompleteClick(formData); handleClose(); }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3
                               rounded-xl font-bold flex items-center justify-center gap-2
                               shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    <CheckCircle className="w-5 h-5" /> השלמת תור + תשלום
                  </button>
                )}

                {/* Edit + Cancel row */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('edit')}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                               text-sm font-medium text-gray-600 dark:text-gray-300
                               hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                               flex items-center justify-center gap-1.5"
                  >
                    <Edit className="w-4 h-4" /> עריכה
                  </button>
                  {!isCancelledOrCompleted && (
                    <button
                      type="button"
                      onClick={() => setShowCancelPanel(true)}
                      className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-800
                                 text-red-500 dark:text-red-400
                                 hover:bg-red-50 dark:hover:bg-red-900/20
                                 text-sm font-medium transition-colors
                                 flex items-center justify-center gap-1.5"
                    >
                      🚫 בטל תור
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            CHANGE 1: EDIT MODE — Form (new appointments OR after clicking Edit)
        ════════════════════════════════════════════════════════════════ */}
        {(!isEditing || mode === 'edit') && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Back to view card button (only when editing existing) */}
            {isEditing && (
              <button
                type="button"
                onClick={() => setMode('view')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#e5007e] transition-colors -mb-1"
              >
                <ChevronRight className="w-3.5 h-3.5" /> חזור לתצוגת תור
              </button>
            )}

            {/* Customer selector */}
            <div>
              {isAddingNewCustomer ? (
                <div className="bg-pink-50/60 dark:bg-[#e5007e]/10 p-4 rounded-xl border border-pink-100 dark:border-[#e5007e]/20 relative">
                  <button type="button" onClick={() => { setIsAddingNewCustomer(false); setNewCustomer({ name: '', phone: '' }); }} className="absolute top-3 left-3 p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors"><X size={15} /></button>
                  <h4 className="text-sm font-bold text-[#e5007e] flex items-center gap-1.5 mb-3"><UserPlus size={15} /> לקוחה חדשה</h4>
                  <div className="space-y-2.5">
                    <input type="text" placeholder="שם מלא *" value={newCustomer.name} onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddCustomer())} className={inputCls} autoFocus />
                    <input type="tel" placeholder="טלפון (אופציונלי)" value={newCustomer.phone} onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddCustomer())} className={inputCls} dir="ltr" />
                    <button type="button" onClick={handleQuickAddCustomer} disabled={savingNewCustomer || !newCustomer.name.trim()} className="w-full py-2 bg-[#e5007e] hover:bg-[#b30062] text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors shadow-md shadow-pink-500/20">{savingNewCustomer ? 'שומר...' : '✓ שמירה ובחירה'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    לקוחה <span className="text-[#e5007e]">*</span>
                  </label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <CustomerSelect customers={customers} value={formData.customerId} onChange={(val) => set('customerId', val)} />
                    </div>
                    <button type="button" onClick={() => setIsAddingNewCustomer(true)} title="הוספת לקוחה חדשה" className="h-[42px] px-3 bg-pink-50 dark:bg-[#e5007e]/10 text-[#e5007e] font-bold rounded-xl shrink-0 hover:bg-pink-100 dark:hover:bg-[#e5007e]/20 transition-colors flex items-center gap-1.5 text-sm">
                      <UserPlus size={16} /><span className="hidden sm:inline">חדשה</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Services selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> טיפולים <span className="text-[#e5007e]">*</span></span>
              </label>
              {showCustomInput ? (
                <div className="space-y-2">
                  <input type="text" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="שם הטיפול המותאם..." className={inputCls} autoFocus />
                  <button type="button" onClick={() => { setShowCustomInput(false); setCustomTitle(''); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline transition-colors">← חזור לבחירה מהמחירון</button>
                </div>
              ) : (
                <ServiceSelector activeServices={activeServices} selectedServices={formData.services} onChange={handleServicesChange} startTime={formData.startTime} />
              )}
              {!showCustomInput && formData.services.length === 0 && (
                <button type="button" onClick={() => setShowCustomInput(true)} className="mt-2 text-xs text-gray-400 hover:text-[#e5007e] transition-colors underline">+ טיפול מותאם אישית שאינו במחירון</button>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">תאריך <span className="text-[#e5007e]">*</span></label>
              <input required type="date" value={formData.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
            </div>

            {/* Start + End time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">שעת התחלה <span className="text-[#e5007e]">*</span></label>
                <input required type="time" value={formData.startTime} onChange={(e) => handleStartTimeChange(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">שעת סיום <span className="text-[#e5007e]">*</span></label>
                <input required type="time" value={formData.endTime} onChange={(e) => set('endTime', e.target.value)} className={inputCls} />
              </div>
            </div>

            {/* Business hours warning */}
            {!businessHoursCheck.allowed && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">מחוץ לשעות הפעילות</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">{businessHoursCheck.reason} — ניתן לשמור בכל זאת</p>
                </div>
              </div>
            )}

            {/* Duration display */}
            {formData.startTime && formData.endTime && formData.endTime > formData.startTime && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1 pr-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {(() => {
                  const [sh, sm] = formData.startTime.split(':').map(Number);
                  const [eh, em] = formData.endTime.split(':').map(Number);
                  const diff = (eh * 60 + em) - (sh * 60 + sm);
                  return diff >= 60 ? `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')} שעות` : `${diff} דקות`;
                })()}
              </p>
            )}

            {/* Change 2: Status dropdown REMOVED — replaced by cancel button in view mode */}
            {/* Change 3: Notes — collapsed by default, editable in edit mode */}
            <NotesAccordion
              value={formData.notes || ''}
              onChange={(val) => set('notes', val)}
            />

            {/* Action buttons */}
            <div className="pt-2 flex flex-col gap-3">
              {isEditing && formData.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => { onCompleteClick(formData); handleClose(); }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all"
                >
                  <CheckCircle className="w-5 h-5" /> סיום וקבלת תשלום
                </button>
              )}
              <div className="flex gap-3 w-full">
                <button type="button" onClick={isEditing ? () => setMode('view') : handleClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {isEditing ? 'בטל עריכה' : 'ביטול'}
                </button>
                <button type="submit" disabled={!canSubmit} className="flex-1 py-2.5 rounded-xl bg-[#e5007e] hover:bg-[#b30062] text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/20">
                  {saving ? 'שומר...' : isEditing ? '💾 שמור שינויים' : '✅ קביעת תור'}
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

// ── Main: Calendar ─────────────────────────────────────────────────────────
export default function Calendar({ setCurrentPage }) {
  const { appointments = [], loading: apptLoading, error, addAppointment, updateAppointment, deleteAppointment, stats } = useAppointments();
  const { loading: srvLoading }  = useServices();
  const { addTransaction }       = useTransactions('income');
  const { showToast }            = useToast();
  const { businessHours, closedDays, loading: settingsLoading } = useBusinessSettings();

  const [currentDate,       setCurrentDate]       = useState(new Date());
  const [gridMode,          setGridMode]          = useState('week');
  const [isModalOpen,       setIsModalOpen]       = useState(false);
  const [isBlockModalOpen,  setIsBlockModalOpen]  = useState(false);
  const [editingApt,        setEditingApt]        = useState(null);
  const [deletingApt,       setDeletingApt]       = useState(null);
  const [chargingApt,       setChargingApt]       = useState(null);

  const loading = apptLoading || srvLoading;

  const dateString = useMemo(() => toDateStr(currentDate), [currentDate]);
  const weekStart  = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDays   = useMemo(() => getWeekDays(weekStart),    [weekStart]);

  const calendarBounds = useMemo(() => {
    const DEFAULT_MIN = new Date(0, 0, 0, 7, 0);
    const DEFAULT_MAX = new Date(0, 0, 0, 22, 0);
    if (!businessHours) return { minTime: DEFAULT_MIN, maxTime: DEFAULT_MAX };
    const activeDays = Object.values(businessHours).filter((day) => day?.isActive && day.start && day.end);
    if (activeDays.length === 0) return { minTime: DEFAULT_MIN, maxTime: DEFAULT_MAX };
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    let earliestMin = Infinity;
    let latestMin   = -Infinity;
    for (const day of activeDays) {
      const start = toMin(day.start);
      const end   = toMin(day.end);
      if (start < earliestMin) earliestMin = start;
      if (end   > latestMin)   latestMin   = end;
    }
    if (earliestMin === Infinity || latestMin === -Infinity) return { minTime: DEFAULT_MIN, maxTime: DEFAULT_MAX };
    const paddedMin = Math.max(0,    earliestMin - 30);
    const paddedMax = Math.min(1439, latestMin   + 30);
    return {
      minTime: new Date(0, 0, 0, Math.floor(paddedMin / 60), paddedMin % 60),
      maxTime: new Date(0, 0, 0, Math.floor(paddedMax / 60), paddedMax % 60),
    };
  }, [businessHours]);

  const closedDaysEvents = useMemo(() => {
    if (!businessHours) return [];
    let datesInView = [];
    if (gridMode === 'week') {
      datesInView = weekDays;
    } else if (gridMode === 'day') {
      datesInView = [currentDate];
    } else {
      const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const viewStart    = getWeekStart(firstOfMonth);
      for (let i = 0; i < 42; i++) {
        const d = new Date(viewStart);
        d.setDate(d.getDate() + i);
        datesInView.push(d);
      }
    }
    const events = [];
    for (const dateObj of datesInView) {
      const dayIndex = dateObj.getDay();
      const cfg = businessHours[dayIndex];
      if (!cfg || !cfg.isActive) {
        const y  = dateObj.getFullYear();
        const mo = dateObj.getMonth();
        const d  = dateObj.getDate();
        events.push({
          id:        `closed-${toDateStr(dateObj)}`,
          title:     'יום סגור',
          start:     new Date(y, mo, d, 0, 0),
          end:       new Date(y, mo, d, 23, 59),
          isBlocked: true,
          resource:  { status: 'blocked' },
        });
      }
    }
    return events;
  }, [businessHours, gridMode, weekDays, currentDate]);

  const navigate = (delta) => {
    const d = new Date(currentDate);
    if (gridMode === 'month')      d.setMonth(d.getMonth() + delta);
    else if (gridMode === 'week') d.setDate(d.getDate() + delta * 7);
    else                          d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  };

  const navTitle = useMemo(() => {
    if (gridMode === 'day')   return currentDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
    if (gridMode === 'month') return currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    return `${weekDays[0].toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [gridMode, currentDate, weekDays]);

  const handleSave = async (data) => {
    try {
      if (editingApt?.id) { await updateAppointment(editingApt.id, data); showToast('התור עודכן בהצלחה ✓', 'success'); }
      else { await addAppointment(data); showToast('התור נקבע בהצלחה ✓', 'success'); setCurrentDate(fromDateStr(data.date)); }
      setEditingApt(null);
    } catch (err) { showToast(err.message || 'שגיאה בשמירה', 'error'); throw err; }
  };

  const handleSaveBlock = async (data) => {
    try { await addAppointment(data); showToast(`🔒 "${data.title}" נחסם בהצלחה`, 'success'); setCurrentDate(fromDateStr(data.date)); }
    catch (err) { showToast(err.message || 'שגיאה בחסימה', 'error'); throw err; }
  };

  // Refactor B: ביטול תור → נכתב ל-activity_logs
  const handleDeleteConfirm = async (reason) => {
    if (!deletingApt) return;
    try {
      if (deletingApt.customerId && deletingApt.customerId !== '__blocked__') {
        await addDoc(collection(db, `customers/${deletingApt.customerId}/activity_logs`), {
          eventType:  'cancellation',
          title:      `תור בוטל: ${deletingApt.title}`.slice(0, 200),
          notes:      reason ? `סיבת ביטול: ${reason}` : 'התור נמחק מהיומן ללא סיבה.',
          price:      0,
          date:       toDateStr(new Date()),
          time:       new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          createdAt:  serverTimestamp(),
        });
      }
      await deleteAppointment(deletingApt.id);
      showToast('התור נמחק', 'success');
    } catch {
      showToast('שגיאה במחיקה', 'error');
    } finally {
      setDeletingApt(null);
    }
  };

  // ✅ Change 2: Cancel (status → 'cancelled') — does NOT delete the appointment
  const handleCancelClick = useCallback(async (apt, reason) => {
    try {
      await updateAppointment(apt.id, { status: 'cancelled' });
      if (apt.customerId && apt.customerId !== '__blocked__') {
        await addDoc(collection(db, `customers/${apt.customerId}/activity_logs`), {
          eventType:  'cancellation',
          title:      `תור בוטל: ${apt.title}`.slice(0, 200),
          notes:      reason ? `סיבת ביטול: ${reason}` : 'התור בוטל.',
          price:      0,
          date:       toDateStr(new Date()),
          time:       new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          createdAt:  serverTimestamp(),
        });
      }
      showToast('התור בוטל ✅', 'success');
    } catch (err) {
      console.error('[handleCancelClick]', err);
      showToast('שגיאה בביטול התור', 'error');
      throw err;
    }
  }, [updateAppointment, showToast]);

  const handleStatusChange = async (id, newStatus) => {
    try { await updateAppointment(id, { status: newStatus }); showToast('סטטוס עודכן ✓', 'success'); }
    catch { showToast('שגיאה בעדכון', 'error'); }
  };

  const handleCompleteClick = (apt) => {
    if (apt.price && apt.price > 0) setChargingApt(apt);
    else handleStatusChange(apt.id, 'completed');
  };

  // Refactor B: תשלום → נכתב ל-activity_logs
  const handleConfirmCharge = async (apt) => {
    try {
      await addTransaction({
        amount:   Number(apt.price),
        category: apt.services?.[0]?.title ?? 'טיפולים',
        source:   apt.customerName || 'לקוחה מהיומן',
        date:     toDateStr(new Date()),
        notes:    `תור אוטומטי: ${apt.title}`,
      });
      await updateAppointment(apt.id, { status: 'completed' });
      if (apt.customerId && apt.customerId !== '__blocked__') {
        await addDoc(collection(db, `customers/${apt.customerId}/activity_logs`), {
          eventType: 'payment',
          title:     'תשלום התקבל 💰',
          notes:     'תשלום עבור ' + apt.title,
          price:     apt.price,
          date:      toDateStr(new Date()),
          time:      new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
        });
      }
      showToast(`₪${apt.price} נוספו להכנסות 💰`, 'success');
    } catch (err) {
      console.error('[ChargeModal]', err);
      showToast('שגיאה בשמירת ההכנסה', 'error');
    } finally {
      setChargingApt(null);
    }
  };

  const openAdd  = () => { setEditingApt(null); setIsModalOpen(true); };
  const openEdit = (apt) => {
    if (apt.isBlocked || apt.status === 'blocked') return;
    setEditingApt(apt); setIsModalOpen(true);
  };

  const handleSelectSlot = ({ start, end }) => {
    const date     = toDateStr(start);
    const dayIndex = start.getDay();
    const cfg = businessHours?.[dayIndex];
    if (!cfg || !cfg.isActive) { showToast('לא ניתן לקבוע תור ביום סגור', 'error'); return; }
    if (closedDays?.includes(date)) { showToast('לא ניתן לקבוע תור ביום חופשה', 'error'); return; }
    let startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    let endTime   = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    if (startTime === '00:00' && endTime === '00:00') { startTime = '10:00'; endTime = '11:00'; }
    setEditingApt({ date, startTime, endTime });
    setIsModalOpen(true);
  };

  // Refactor B: שינוי מועד (גרירה) → activity_logs
  const handleEventDrop = useCallback(async ({ event, start, end }) => {
    if (event.isBlocked) return;
    const date = toDateStr(start);
    let startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    let endTime   = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    if (startTime === '00:00' && endTime === '00:00') { startTime = event.resource.startTime; endTime = event.resource.endTime; }
    try {
      await updateAppointment(event.id, { date, startTime, endTime });
      const customerId = event.resource?.customerId;
      if (customerId && customerId !== '__blocked__') {
        await addDoc(collection(db, `customers/${customerId}/activity_logs`), {
          eventType: 'reschedule', title: 'שינוי מועד תור 🔄',
          notes: 'התור הוזז לתאריך ' + date + ' בשעה ' + startTime,
          price: 0, date: toDateStr(new Date()),
          time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
        });
      }
      showToast('התור הוזז בהצלחה ✓', 'success');
    } catch (err) { console.error('[DnD Drop]', err); showToast('שגיאה בהזזת התור', 'error'); }
  }, [updateAppointment, showToast]);

  // Refactor B: שינוי מועד (שינוי גודל) → activity_logs
  const handleEventResize = useCallback(async ({ event, start, end }) => {
    if (event.isBlocked) return;
    const date      = toDateStr(start);
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const endTime   = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    try {
      await updateAppointment(event.id, { date, startTime, endTime });
      const customerId = event.resource?.customerId;
      if (customerId && customerId !== '__blocked__') {
        await addDoc(collection(db, `customers/${customerId}/activity_logs`), {
          eventType: 'reschedule', title: 'שינוי מועד תור 🔄',
          notes: 'התור שונה לתאריך ' + date + ' בשעה ' + startTime,
          price: 0, date: toDateStr(new Date()),
          time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
        });
      }
      showToast('זמן התור עודכן בהצלחה ✓', 'success');
    } catch (err) { console.error('[DnD Resize]', err); showToast('שגיאה בעדכון הזמן', 'error'); }
  }, [updateAppointment, showToast]);

  const handleModalClose = () => { setIsModalOpen(false); setEditingApt(null); };

  if (loading) return (
    <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'מתוכננים', value: stats.scheduled, cls: 'text-blue-500'  },
          { label: 'הושלמו',   value: stats.completed,  cls: 'text-green-500' },
          { label: 'בוטלו',    value: stats.cancelled,  cls: 'text-gray-400'  },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-sm border border-gray-100 dark:border-gray-700">
            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={openAdd} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-[#e5007e] text-white rounded-xl hover:bg-[#b30062] shadow-lg shadow-pink-500/20 transition-all font-bold">
            <Plus className="w-5 h-5" /> תור חדש
          </button>
          <button onClick={() => setIsBlockModalOpen(true)} title="חסום זמן ביומן" className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400 rounded-xl border border-orange-200 dark:border-orange-800/50 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-all font-semibold text-sm">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">חסום זמן</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-[#e5007e] hover:bg-pink-50 dark:hover:bg-gray-700 rounded-full transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="relative text-center min-w-[190px] group cursor-pointer">
            <div className="flex items-center justify-center gap-2 text-gray-900 dark:text-white group-hover:text-[#e5007e] transition-colors relative">
              <CalendarIcon className="w-5 h-5 text-[#e5007e]" />
              <h2 className="text-base font-bold">{navTitle}
                              </h2>
              {gridMode === 'day' && (
                <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={dateString} onChange={(e) => { if (e.target.value) setCurrentDate(fromDateStr(e.target.value)); }} />
              )}
            </div>
          </div>
          <button onClick={() => navigate(1)} className="p-2 text-gray-500 hover:text-[#e5007e] hover:bg-pink-50 dark:hover:bg-gray-700 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCurrentDate(new Date()); setGridMode('day'); showToast('חזרנו להיום!', 'success'); }}
            className="px-3 py-2 text-sm font-semibold text-[#e5007e] bg-pink-50 dark:bg-[#e5007e]/10 rounded-xl hover:bg-pink-100 dark:hover:bg-[#e5007e]/20 transition-colors">
            היום
          </button>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 gap-1">
            <button onClick={() => setGridMode('month')} title="תצוגה חודשית"
              className={`p-2 flex items-center gap-1.5 rounded-lg transition-colors ${gridMode === 'month' ? 'bg-white dark:bg-gray-600 text-[#e5007e] shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <CalendarIcon className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">חודש</span>
            </button>
            <button onClick={() => setGridMode('week')} title="תצוגה שבועית"
              className={`p-2 flex items-center gap-1.5 rounded-lg transition-colors ${gridMode === 'week' ? 'bg-white dark:bg-gray-600 text-[#e5007e] shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <CalendarDays className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">שבוע</span>
            </button>
            <button onClick={() => setGridMode('day')} title="תצוגה יומית"
              className={`p-2 flex items-center gap-1.5 rounded-lg transition-colors ${gridMode === 'day' ? 'bg-white dark:bg-gray-600 text-[#e5007e] shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <LayoutList className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">יום</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">{error}</div>
      )}

      <CalendarView
        appointments={[...appointments, ...closedDaysEvents]}
        onSelectEvent={(e) => openEdit(e.resource)}
        onSelectSlot={handleSelectSlot}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        minTime={calendarBounds.minTime}
        maxTime={calendarBounds.maxTime}
        businessHours={businessHours}
        closedDays={closedDays}
        date={currentDate}
        onNavigate={(newDate) => setCurrentDate(newDate)}
        view={gridMode}
        onView={(newView) => setGridMode(newView)}
      />

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        selectedDate={dateString}
        initialData={editingApt}
        businessHours={businessHours}
        closedDays={closedDays}
        setCurrentPage={setCurrentPage}
        onCompleteClick={handleCompleteClick}
        onDeleteClick={(apt) => setDeletingApt(apt)}
        onCancelClick={handleCancelClick}
      />
      <BlockTimeModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onSave={handleSaveBlock}
        selectedDate={dateString}
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
        onConfirmWithoutCharge={(apt) => { handleStatusChange(apt.id, 'completed'); setChargingApt(null); }}
        onCancel={() => setChargingApt(null)}
      />
    </div>
  );
}