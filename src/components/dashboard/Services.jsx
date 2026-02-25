// src/components/dashboard/Services.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useServices } from '../../hooks/useServices';
import { useToast } from '../../context/ToastContext';
import {
  Plus, Edit, Trash2, Clock, Wallet, Tag,
  ToggleRight, ToggleLeft, AlertCircle, X, Layers
} from 'lucide-react';
import gsap from 'gsap';

const PRESET_COLORS = [
  '#e5007e', '#8b5cf6', '#3b82f6', '#10b981',
  '#f59e0b', '#f97316', '#ef4444', '#64748b',
];

const EMPTY_FORM = {
  title: '', duration: 60, price: '', color: '#e5007e', notes: '', isActive: true,
};

// ── עיצוב משותף לשדות טופס ───────────────────────────────────────────
const inputCls = `w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600
  bg-gray-50 dark:bg-gray-700 dark:text-white text-sm outline-none
  focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all`;

// ── המרת דקות לתצוגה קריאה ────────────────────────────────────────────
function formatDuration(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} שעות` : `${h}:${String(m).padStart(2, '0')} שעות`;
}

// ══════════════════════════════════════════════════════════════════════
// Modal מחיקה
// ══════════════════════════════════════════════════════════════════════
function DeleteServiceModal({ isOpen, serviceTitle, onConfirm, onCancel }) {
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);

  useEffect(() => {
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)' }
    );
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">מחיקת שירות</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              למחוק את{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">"{serviceTitle}"</span>?
              {' '}פעולה זו אינה ניתנת לביטול.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
              text-sm font-medium text-gray-600 dark:text-gray-300
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
              text-white text-sm font-semibold transition-colors"
          >
            מחק
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Modal הוספה / עריכה
// ══════════════════════════════════════════════════════════════════════
function ServiceModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);
  const isEditing  = !!initialData?.id;

  useEffect(() => {
    if (!isOpen) return;
    setFormData(initialData ? { ...EMPTY_FORM, ...initialData } : EMPTY_FORM);
    setSaving(false);
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen || !overlayRef.current || !modalRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' }
    );
  }, [isOpen]);

  const handleClose = () => {
    if (!overlayRef.current || !modalRef.current) { onClose(); return; }
    gsap.to(modalRef.current,   { opacity: 0, y: 20, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    // וולידציה נוספת בצד לקוח
    if (!formData.title.trim()) return;
    if (Number(formData.price) < 0) return;
    setSaving(true);
    try {
      await onSave(formData);
      handleClose();
    } catch {
      // שגיאה מטופלת בפונקציה הקוראת
    } finally {
      setSaving(false);
    }
  };

  const set = (field, value) => setFormData((p) => ({ ...p, [field]: value }));

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      dir="rtl"
    >
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* כותרת */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {isEditing ? 'עריכת שירות' : 'שירות חדש ✨'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-[#e5007e] rounded-full hover:bg-pink-50
              dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* שם השירות */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              שם השירות / טיפול *
            </label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="לדוג׳: בנייה באקריל"
              className={inputCls}
            />
          </div>

          {/* זמן + מחיר */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                זמן (בדקות) *
              </label>
              <input
                required type="number" min="5" step="5"
                value={formData.duration}
                onChange={(e) => set('duration', e.target.value)}
                placeholder="60"
                className={inputCls}
              />
              {/* תצוגה מקדימה */}
              {formData.duration > 0 && (
                <p className="text-[11px] text-[#e5007e] mt-1 font-medium">
                  = {formatDuration(Number(formData.duration))}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                מחיר (₪) *
              </label>
              <input
                required type="number" min="0"
                value={formData.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* בחירת צבע */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              צבע ביומן
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => set('color', c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform
                    ${formData.color === c
                      ? 'scale-110 border-gray-900 dark:border-white shadow-md ring-2 ring-offset-1 ring-gray-400'
                      : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* הערות */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              תיאור קצר (אופציונלי)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={`${inputCls} resize-none`}
              placeholder="לדוג׳: כולל מניקור רוסי, צרובה..."
            />
          </div>

          {/* כפתורים */}
          <div className="pt-2 flex gap-3">
            <button
              type="button" onClick={handleClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600
                text-sm font-medium text-gray-600 dark:text-gray-300
                hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving || !formData.title.trim() || formData.price === ''}
              className="flex-1 py-3 rounded-xl bg-[#e5007e] hover:bg-[#b30062] text-white
                text-sm font-bold transition-colors disabled:opacity-50
                disabled:cursor-not-allowed shadow-lg shadow-pink-500/20"
            >
              {saving ? 'שומר...' : isEditing ? '💾 שמור שינויים' : '✨ הוסף שירות'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// כרטיס שירות בודד
// ══════════════════════════════════════════════════════════════════════
function ServiceCard({ service, onEdit, onDelete, onToggle }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm
        border border-gray-100 dark:border-gray-700 transition-all duration-200
        ${!service.isActive
          ? 'opacity-55 grayscale-[40%]'
          : 'hover:shadow-lg hover:-translate-y-0.5'}`}
    >
      {/* שורה עליונה */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-4 h-4 rounded-full shrink-0 shadow-inner"
            style={{ backgroundColor: service.color ?? '#e5007e' }}
          />
          <h3
            className={`font-bold text-base leading-tight
              ${!service.isActive
                ? 'text-gray-400 line-through'
                : 'text-gray-900 dark:text-white'}`}
          >
            {service.title}
          </h3>
        </div>

        {/* פעולות */}
        <div className="flex gap-1 shrink-0 mr-2">
          <button
            onClick={() => onToggle(service)}
            className={`p-1.5 rounded-lg transition-colors
              ${service.isActive
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title={service.isActive ? 'השבת שירות' : 'הפעל שירות'}
          >
            {service.isActive
              ? <ToggleRight className="w-5 h-5" />
              : <ToggleLeft  className="w-5 h-5" />}
          </button>
          <button
            onClick={() => onEdit(service)}
            className="p-1.5 text-gray-400 hover:text-[#e5007e] hover:bg-pink-50
              dark:hover:bg-pink-900/20 rounded-lg transition-colors"
            title="עריכה"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(service)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50
              dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="מחיקה"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* פרטים */}
      <div className="flex items-center gap-4 text-sm mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>{formatDuration(service.duration)}</span>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
          <Wallet className="w-4 h-4 text-gray-400" />
          <span>₪{Number(service.price).toLocaleString('he-IL')}</span>
        </div>
        {!service.isActive && (
          <span className="mr-auto text-[11px] bg-gray-100 dark:bg-gray-700
            text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
            מושבת
          </span>
        )}
      </div>

      {service.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3
          bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg leading-relaxed">
          {service.notes}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main: Services
// ══════════════════════════════════════════════════════════════════════
export default function Services() {
  const {
    services, loading, error,
    addService, updateService, deleteService, toggleServiceActive,
  } = useServices();
  const { showToast } = useToast();

  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [editingService,  setEditingService]  = useState(null);
  const [deletingService, setDeletingService] = useState(null);
  const [filter,          setFilter]          = useState('all'); // 'all' | 'active' | 'inactive'
  const listRef = useRef(null);

  // ─── אנימציית כניסה ────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-card]');
    if (!items.length) return;
    gsap.fromTo(items,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
    );
  }, [loading, filter]);

  // ─── סינון ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'active')   return services.filter((s) => s.isActive !== false);
    if (filter === 'inactive') return services.filter((s) => s.isActive === false);
    return services;
  }, [services, filter]);

  // ─── סטטיסטיקות ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active   = services.filter((s) => s.isActive !== false);
    const avgPrice = active.length
      ? Math.round(active.reduce((s, sv) => s + Number(sv.price), 0) / active.length)
      : 0;
    const avgDuration = active.length
      ? Math.round(active.reduce((s, sv) => s + Number(sv.duration), 0) / active.length)
      : 0;
    return { total: services.length, active: active.length, avgPrice, avgDuration };
  }, [services]);

  // ─── שמירה ─────────────────────────────────────────────────────────
  const handleSave = async (data) => {
    try {
      if (editingService?.id) {
        await updateService(editingService.id, data);
        showToast('השירות עודכן בהצלחה ✓', 'success');
      } else {
        await addService(data);
        showToast('השירות נוסף בהצלחה ✓', 'success');
      }
      setEditingService(null);
    } catch (err) {
      showToast(err.message || 'שגיאה בשמירה', 'error');
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingService) return;
    try {
      await deleteService(deletingService.id);
      showToast('השירות נמחק', 'success');
    } catch {
      showToast('שגיאה במחיקה', 'error');
    } finally {
      setDeletingService(null);
    }
  };

  const handleToggleActive = async (service) => {
    try {
      await toggleServiceActive(service.id, service.isActive);
      showToast(
        service.isActive ? `"${service.title}" הושבת` : `"${service.title}" הופעל מחדש`,
        'success'
      );
    } catch {
      showToast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  const openAdd  = () => { setEditingService(null);    setIsModalOpen(true); };
  const openEdit = (s) => { setEditingService(s);      setIsModalOpen(true); };

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="w-7 h-7 text-[#e5007e]" />
            מחירון ושירותים
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            ניהול סוגי הטיפולים, מחירים וזמנים לקביעת תורים חכמה
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#e5007e] hover:bg-[#b30062]
            text-white rounded-2xl font-bold shadow-lg shadow-pink-500/20 transition-colors
            whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> שירות חדש
        </button>
      </div>

      {/* ── סטטיסטיקות ─────────────────────────────────────────────── */}
      {services.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'סה"כ שירותים', value: stats.total,    icon: Layers,  color: 'text-purple-500' },
            { label: 'שירותים פעילים', value: stats.active, icon: Tag,     color: 'text-green-500'  },
            { label: 'מחיר ממוצע',  value: `₪${stats.avgPrice.toLocaleString('he-IL')}`, icon: Wallet, color: 'text-[#e5007e]' },
            { label: 'זמן ממוצע',   value: formatDuration(stats.avgDuration), icon: Clock,  color: 'text-blue-500'   },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl p-4
              border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
          rounded-xl text-sm border border-red-100 dark:border-red-800">
          {error}
        </div>
      )}

      {/* ── Tabs סינון ─────────────────────────────────────────────── */}
      {services.length > 0 && (
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {[
            { key: 'all',      label: `הכל (${services.length})`  },
            { key: 'active',   label: `פעילים (${stats.active})`  },
            { key: 'inactive', label: `מושבתים (${services.length - stats.active})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                ${filter === key
                  ? 'bg-white dark:bg-gray-700 text-[#e5007e] shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Grid / Empty state ─────────────────────────────────────── */}
      {services.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl
          border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-pink-50 dark:bg-pink-900/20 rounded-full
            flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-[#e5007e]" />
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold mb-1">
            עדיין אין שירותים מוגדרים
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-5">
            הגדירי את הטיפולים שלך פעם אחת – ובכל תור הם יחושבו אוטומטית
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#e5007e]
              hover:bg-[#b30062] text-white rounded-2xl font-bold
              shadow-lg shadow-pink-500/20 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> הוספת שירות ראשון
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-sm">אין שירותים בקטגוריה זו</p>
        </div>
      ) : (
        <div ref={listRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <div key={service.id} data-card>
              <ServiceCard
                service={service}
                onEdit={openEdit}
                onDelete={setDeletingService}
                onToggle={handleToggleActive}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingService}
      />
      <DeleteServiceModal
        isOpen={!!deletingService}
        serviceTitle={deletingService?.title ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingService(null)}
      />
    </div>
  );
}
