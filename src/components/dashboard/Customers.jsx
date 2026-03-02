// src/components/dashboard/Customers.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCustomers } from '../../hooks/useCustomers';
import { useToast } from '../../context/ToastContext';
import { Search, Plus, Phone, User, Edit, Trash2, X, Tag, AlertCircle } from 'lucide-react';
import gsap from 'gsap';
import CustomerProfile from './CustomerProfile';

// ── Helpers ────────────────────────────────────────────────────────────────

const CUSTOMER_TYPE_STYLES = {
  vip:     { label: 'VIP',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  new:     { label: 'חדשה',  cls: 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400'  },
  regular: { label: 'רגילה', cls: 'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-400'   },
};

const EMPTY_FORM = {
  name: '', phone: '', email: '', birthdate: '', gender: '',
  customerType: 'regular', tags: '', notes: '', medicalNotes: '', allergies: '',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('he-IL');
}

// ── DeleteConfirmModal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ isOpen, customerName, onConfirm, onCancel }) {
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
            <h3 className="font-bold text-gray-800 dark:text-gray-100">מחיקת לקוחה</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              האם למחוק את{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {customerName}
              </span>? פעולה זו אינה ניתנת לביטול.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
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

// ── CustomerModal (Add / Edit) ─────────────────────────────────────────────

function CustomerModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const overlayRef = useRef(null);
  const modalRef   = useRef(null);
  const isEditing  = !!initialData?.id;

  useEffect(() => {
    if (!isOpen) return;
    setFormData(initialData
      ? { ...EMPTY_FORM, ...initialData, tags: (initialData.tags ?? []).join(', ') }
      : EMPTY_FORM
    );
    setSaving(false);
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, y: 40, scale: 0.96 },
      { opacity: 1, y: 0,  scale: 1, duration: 0.35, ease: 'power3.out' }
    );
  }, [isOpen]);

  const handleClose = () => {
    gsap.to(modalRef.current,   { opacity: 0, y: 20, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const set = (field) => (e) => setFormData((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const tagsArray = formData.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await onSave({ ...formData, tags: tagsArray });
      handleClose();
    } catch {
      // Toast מוצג ב-parent
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = `w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600
    bg-gray-50 dark:bg-gray-700 dark:text-white text-sm
    focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] outline-none transition-all`;

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50
                 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
      dir="rtl"
    >
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                   w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 px-6 py-4
                         border-b border-gray-100 dark:border-gray-700
                         flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {isEditing ? 'עריכת לקוחה' : 'לקוחה חדשה'}
          </h2>
          <button onClick={handleClose}
            className="p-2 text-gray-400 hover:text-[#e5007e] rounded-full
                       hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">
                שם מלא <span className="text-[#e5007e]">*</span>
              </label>
              <input required type="text" value={formData.name}
                onChange={set('name')} className={inputCls}
                placeholder="לדוגמה: שרה כהן" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">
                טלפון <span className="text-[#e5007e]">*</span>
              </label>
              <input required type="tel" value={formData.phone}
                onChange={set('phone')} className={inputCls}
                placeholder="050-0000000" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">אימייל</label>
              <input type="email" value={formData.email}
                onChange={set('email')} className={inputCls}
                placeholder="example@gmail.com" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">תאריך לידה</label>
              <input type="date" value={formData.birthdate}
                onChange={set('birthdate')} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">מגדר</label>
              <select value={formData.gender} onChange={set('gender')} className={inputCls}>
                <option value="">בחרי...</option>
                <option value="female">נקבה</option>
                <option value="male">זכר</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600
                                dark:text-gray-400 mb-1">סוג לקוח</label>
              <select value={formData.customerType} onChange={set('customerType')} className={inputCls}>
                <option value="regular">רגילה</option>
                <option value="vip">VIP</option>
                <option value="new">חדשה</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              תגיות <span className="text-gray-400 font-normal">(מופרדות בפסיק)</span>
            </label>
            <input type="text" value={formData.tags} onChange={set('tags')}
              placeholder="לדוג׳: לק ג׳ל, אקנה, VIP" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">הערות כלליות</label>
            <textarea rows={2} value={formData.notes} onChange={set('notes')}
              className={`${inputCls} resize-none`} />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4
                           flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#e5007e]" />
              מידע רפואי
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600
                                  dark:text-gray-400 mb-1">הערות רפואיות</label>
                <textarea rows={2} value={formData.medicalNotes}
                  onChange={set('medicalNotes')} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600
                                  dark:text-gray-400 mb-1">אלרגיות / רגישויות</label>
                <textarea rows={2} value={formData.allergies}
                  onChange={set('allergies')} className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         text-sm font-medium text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              ביטול
            </button>
            <button type="submit"
              disabled={saving || !formData.name.trim() || !formData.phone.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#e5007e] hover:bg-[#b30062]
                         text-white text-sm font-semibold transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-lg shadow-pink-500/20">
              {saving ? 'שומר...' : isEditing ? 'שמור שינויים' : 'הוסף לקוחה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CustomerCard ───────────────────────────────────────────────────────────

function CustomerCard({ customer, onEdit, onDelete, onClick, cardRef }) {
  const typeMeta = CUSTOMER_TYPE_STYLES[customer.customerType] ?? CUSTOMER_TYPE_STYLES.regular;

  return (
    <div ref={cardRef}
      onClick={() => onClick(customer)}
      className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm
                 border border-gray-100 dark:border-gray-700 cursor-pointer
                 hover:shadow-md hover:border-[#e5007e]/30 dark:hover:border-[#e5007e]/50
                 transition-all flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-pink-50 dark:bg-gray-700
                          flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-[#e5007e]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white truncate">
              {customer.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400
                          flex items-center gap-1 mt-0.5" dir="ltr">
              <Phone className="w-3 h-3 shrink-0" />
              {customer.phone}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onEdit(customer); }}
            className="p-1.5 text-gray-400 hover:text-[#e5007e]
                       hover:bg-pink-50 dark:hover:bg-pink-900/20
                       rounded-lg transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(customer); }}
            className="p-1.5 text-gray-400 hover:text-red-500
                       hover:bg-red-50 dark:hover:bg-red-900/20
                       rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${typeMeta.cls}`}>
          {typeMeta.label}
        </span>
        {customer.allergies && (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold
                           bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            ⚠ רגישות
          </span>
        )}
      </div>

      {(customer.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customer.tags.map((tag) => (
            <span key={tag}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                         bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {customer.totalVisits > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 border-t
                      border-gray-100 dark:border-gray-700 pt-3 mt-auto">
          {customer.totalVisits} ביקורים
          {customer.lastVisit && ` · ביקור אחרון: ${formatDate(customer.lastVisit)}`}
        </p>
      )}
    </div>
  );
}

// ── Main: Customers ────────────────────────────────────────────────────────

export default function Customers({ prefilledContact }) {
  const {
    customers, loading, error,
    addCustomer, updateCustomer, deleteCustomer,
    searchCustomers, getCustomerById,
  } = useCustomers();
  const { showToast } = useToast();

  const location = useLocation();
  const navigate  = useNavigate();

  const [searchTerm,       setSearchTerm]       = useState('');
  const [filterType,       setFilterType]       = useState('all');
  const [isModalOpen,      setIsModalOpen]      = useState(false);
  const [editingCustomer,  setEditingCustomer]  = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [selectedId,       setSelectedId]       = useState(null);

  const cardsRef = useRef([]);

  const selectedCustomer = useMemo(
    () => (selectedId ? getCustomerById(selectedId) : null),
    [selectedId, customers, getCustomerById]
  );

  useEffect(() => {
    if (location.state?.selectedCustomerId) {
      setSelectedId(location.state.selectedCustomerId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // ניתוב חכם מבחוץ (prefilledContact)
  useEffect(() => {
    if (prefilledContact?.id) setSelectedId(prefilledContact.id);
  }, [prefilledContact]);

  const filteredCustomers = useMemo(() => {
    let result = searchCustomers(searchTerm);
    if (filterType !== 'all') result = result.filter((c) => c.customerType === filterType);
    return result;
  }, [searchTerm, filterType, searchCustomers]);

  // GSAP stagger — רק כשרשימה מוצגת
  useEffect(() => {
    if (selectedId) return;
    const els = cardsRef.current.filter(Boolean);
    if (els.length === 0) return;
    gsap.fromTo(els,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.05,
        ease: 'power2.out', clearProps: 'all' }
    );
  }, [filteredCustomers, selectedId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = async (data) => {
    try {
      if (editingCustomer?.id) {
        await updateCustomer(editingCustomer.id, data);
        showToast('הלקוחה עודכנה בהצלחה ✓', 'success');
      } else {
        await addCustomer(data);
        showToast('הלקוחה נוספה בהצלחה ✓', 'success');
      }
      setEditingCustomer(null);
    } catch (err) {
      showToast(err.message || 'שגיאה בשמירה', 'error');
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCustomer) return;
    try {
      await deleteCustomer(deletingCustomer.id);
      showToast('הלקוחה נמחקה', 'success');
      if (selectedId === deletingCustomer.id) setSelectedId(null);
    } catch {
      showToast('שגיאה במחיקה', 'error');
    } finally {
      setDeletingCustomer(null);
    }
  };

  const openEdit  = (customer) => { setEditingCustomer(customer); setIsModalOpen(true); };
  const openAdd   = ()         => { setEditingCustomer(null);     setIsModalOpen(true); };
  const handleModalClose = ()  => { setIsModalOpen(false); setEditingCustomer(null); };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent
                      rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <CustomerModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        initialData={editingCustomer}
      />

      <DeleteConfirmModal
        isOpen={!!deletingCustomer}
        customerName={deletingCustomer?.name ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingCustomer(null)}
      />

      {/* ✅ 1. תיקון הבאג: אנחנו מחכים שהלקוח ייטען ולא סוגרים מיד את הפרופיל! */}
      {selectedId ? (
        selectedCustomer ? (
          <CustomerProfile
            customer={selectedCustomer}
            onBack={() => setSelectedId(null)}
            onEdit={openEdit}
          />
        ) : (
          <div className="flex flex-col justify-center items-center py-32">
             <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin mb-4" />
             <p className="text-gray-500 font-medium">פותח כרטיס לקוח...</p>
          </div>
        )
      ) : (
        // ── רשימת לקוחות ─────────────────────────────────────────────────
        <div className="p-4 md:p-8 space-y-6" dir="rtl">

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start
                          sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white
                             flex items-center gap-2">
                <User className="w-7 h-7 text-[#e5007e]" />
                ניהול לקוחות
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                סה״כ {customers.length} לקוחות במערכת
              </p>
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#e5007e]
                         hover:bg-[#b30062] text-white rounded-2xl font-bold
                         shadow-lg shadow-[#e5007e]/20 transition-colors">
              <Plus className="w-5 h-5" />
              לקוחה חדשה
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200
                            dark:border-red-800 text-red-700 dark:text-red-400
                            rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2
                                 text-gray-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, טלפון או תגית..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200
                           dark:border-gray-700 bg-white dark:bg-gray-800
                           dark:text-white text-sm
                           focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e]
                           outline-none transition-all shadow-sm"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 dark:text-white text-sm outline-none
                         focus:border-[#e5007e] shadow-sm min-w-[140px]"
            >
              <option value="all">כל הלקוחות</option>
              <option value="regular">רגילות</option>
              <option value="vip">VIP</option>
              <option value="new">חדשות</option>
            </select>
          </div>

          {/* Grid */}
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50
                            rounded-3xl border-2 border-dashed
                            border-gray-200 dark:border-gray-700">
              <User className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {searchTerm || filterType !== 'all'
                  ? 'לא נמצאו לקוחות תואמות'
                  : 'אין לקוחות עדיין'}
              </p>
              {!searchTerm && filterType === 'all' && (
                <button onClick={openAdd}
                  className="mt-3 text-sm text-[#e5007e] font-semibold hover:underline">
                  + הוסיפי לקוחה ראשונה
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCustomers.map((customer, index) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  cardRef={(el) => { cardsRef.current[index] = el; }}
                  onEdit={openEdit}
                  onDelete={setDeletingCustomer}
                  onClick={(c) => setSelectedId(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}