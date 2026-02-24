// src/components/dashboard/SmartTemplates.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import {
  MessageCircle, Copy, Plus, Trash2, Pencil, X,
  CheckCheck, Phone, User, Scissors, Clock,
  Tag, Filter, Hash,
} from 'lucide-react';
import { useTemplates } from '../../hooks/useTemplates';
import { useToast } from '../../context/ToastContext';

// ── Constants ──────────────────────────────────────────────────────────────

const VARIABLES = [
  { key: '{name}',    label: 'שם הלקוחה',   icon: User,     placeholder: 'לדוגמה: שרה'         },
  { key: '{service}', label: 'סוג הטיפול',  icon: Scissors, placeholder: 'לדוגמה: מניקור ג׳ל'  },
  { key: '{time}',    label: 'שעה / תאריך', icon: Clock,    placeholder: 'לדוגמה: יום ב׳ 14:00' },
];

const CATEGORIES = [
  { id: 'reminders',  label: 'תזכורות',       color: 'bg-blue-100   text-blue-600   dark:bg-blue-900/30   dark:text-blue-400'   },
  { id: 'marketing',  label: 'שיווק',         color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'followup',   label: 'פולו-אפ',       color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'first_time', label: 'לקוחות חדשות', color: 'bg-green-100  text-green-600  dark:bg-green-900/30  dark:text-green-400'  },
  { id: 'general',    label: 'כללי',          color: 'bg-gray-100   text-gray-600   dark:bg-gray-700      dark:text-gray-300'   },
];

const QUICK_CHIPS = ['{name}', '{service}', '{time}'];
const EMPTY_FORM  = { title: '', body: '', categories: [] };

// ── Helpers ────────────────────────────────────────────────────────────────

function processText(body, vars) {
  return body
    .replace(/\{name\}/g,    vars.name    || '{name}')
    .replace(/\{service\}/g, vars.service || '{service}')
    .replace(/\{time\}/g,    vars.time    || '{time}');
}

function sanitizePhone(raw) {
  let num = raw.replace(/[\s\-().]/g, '');
  if (num.startsWith('0'))  num = '972' + num.slice(1);
  if (num.startsWith('+'))  num = num.slice(1);
  return num;
}

// ── TemplateModal ──────────────────────────────────────────────────────────

function TemplateModal({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const overlayRef  = useRef(null);
  const modalRef    = useRef(null);
  const textareaRef = useRef(null);
  const isEditing   = !!initialData?.id;

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialData
      ? { title: initialData.title, body: initialData.body, categories: initialData.categories ?? [] }
      : EMPTY_FORM
    );
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.4)' }
    );
  }, [isOpen]);

  const handleClose = () => {
    gsap.to(modalRef.current,   { opacity: 0, scale: 0.94, y: 10, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const toggleCategory = (catId) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter((id) => id !== catId)
        : [...prev.categories, catId],
    }));
  };

  const insertChip = (chip) => {
    const el = textareaRef.current;
    if (!el) return;
    const start   = el.selectionStart;
    const end     = el.selectionEnd;
    const newBody = form.body.slice(0, start) + chip + form.body.slice(end);
    setForm((p) => ({ ...p, body: newBody }));
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + chip.length;
      el.focus();
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, title: form.title.trim(), body: form.body.trim() });
      handleClose(); // ✅ נסגר רק אחרי הצלחה
    } catch {
      // Toast מוצג ב-parent — Modal נשאר פתוח
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = `w-full text-sm rounded-xl border border-gray-300 dark:border-gray-600
    bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100
    px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#e5007e] transition`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6
                   max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {isEditing ? 'עריכת תבנית' : 'תבנית חדשה'}
          </h2>
          <button onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100
                       dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Categories */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-2">
              קטגוריות (ניתן לבחור כמה)
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    form.categories.includes(cat.id)
                      ? 'bg-[#e5007e] text-white border-[#e5007e]'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              כותרת התבנית <span className="text-[#e5007e]">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="לדוגמה: תזכורת תור למניקור"
              className={inputCls} required autoFocus
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-600
                              dark:text-gray-400 mb-1">
              תוכן ההודעה <span className="text-[#e5007e]">*</span>
            </label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {QUICK_CHIPS.map((chip) => (
                <button key={chip} type="button" onClick={() => insertChip(chip)}
                  className="text-xs px-2.5 py-1 rounded-full border border-[#e5007e]/40
                             text-[#e5007e] bg-pink-50 dark:bg-pink-900/20
                             hover:bg-[#e5007e] hover:text-white transition-colors font-mono">
                  + {chip}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef} value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              placeholder={'היי {name}, רצינו להזכיר לך שיש לך תור ל{service} ב{time} 💅'}
              rows={5} className={`${inputCls} resize-none`} required
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         text-sm font-medium text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              ביטול
            </button>
            <button type="submit" disabled={saving || !form.title.trim() || !form.body.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#e5007e] text-white text-sm font-semibold
                         hover:bg-[#b30062] disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors">
              {saving ? 'שומר...' : isEditing ? 'שמור שינויים' : 'הוסף תבנית'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TemplateCard ───────────────────────────────────────────────────────────

function TemplateCard({ template, vars, phone, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);
  const cardRef   = useRef(null);
  const processed = processText(template.body, vars);
  const hasPhone  = phone.trim().length > 0;

  // ✅ GSAP entrance — שוחזר מהגרסה המקורית
  useEffect(() => {
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(processed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('[TemplateCard] copy failed');
    }
  };

  const handleWhatsApp = () => {
    const sanitized = sanitizePhone(phone);
    window.open(`https://wa.me/${sanitized}?text=${encodeURIComponent(processed)}`, '_blank');
  };

  return (
    <div ref={cardRef}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200
                 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow
                 p-4 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-snug truncate flex-1 ml-2">
          {template.title}
        </h3>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(template)}
            className="p-1.5 text-gray-400 hover:text-[#e5007e]
                       hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(template.id)}
            className="p-1.5 text-gray-400 hover:text-red-500
                       hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category tags */}
      {(template.categories ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.categories.map((catId) => {
            const cat = CATEGORIES.find((c) => c.id === catId);
            return cat ? (
              <span key={catId}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.color}`}>
                {cat.label}
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Preview */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-4 flex-1
                      border border-gray-100 dark:border-gray-600 min-h-[60px]">
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
          {processed}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button onClick={handleCopy}
          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all
                      flex items-center justify-center gap-1.5 ${
            copied
              ? 'bg-green-50 border-green-200 text-green-600 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-[#e5007e] hover:text-[#e5007e] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
          }`}>
          {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'הועתק!' : 'העתק'}
        </button>
        <button onClick={handleWhatsApp} disabled={!hasPhone}
          title={!hasPhone ? 'הכניסי מספר טלפון כדי לשלוח' : `שלח ל-${phone}`}
          className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#25D366] hover:bg-[#128C7E]
                     text-white flex items-center justify-center gap-1.5 transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-300
                     dark:disabled:bg-gray-600">
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </button>
      </div>
    </div>
  );
}

// ── Main: SmartTemplates ───────────────────────────────────────────────────

export default function SmartTemplates({ prefilledContact = null }) {
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const { showToast } = useToast();

  const [filter,  setFilter]  = useState('all');
  const [phone,   setPhone]   = useState(prefilledContact?.phone ?? '');
  const [name,    setName]    = useState(prefilledContact?.name  ?? '');
  const [service, setService] = useState('');
  const [time,    setTime]    = useState('');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingTmpl, setEditingTmpl] = useState(null);

  useEffect(() => {
    if (prefilledContact?.phone) setPhone(prefilledContact.phone);
    if (prefilledContact?.name)  setName(prefilledContact.name);
  }, [prefilledContact]);

  const vars = { name, service, time };

  const filteredTemplates = useMemo(() =>
    filter === 'all' ? templates : templates.filter((t) => (t.categories ?? []).includes(filter)),
  [templates, filter]);

  // ── CRUD handlers ──────────────────────────────────────────────────────

  const handleSave = async (formData) => {
    try {
      if (editingTmpl?.id) {
        await updateTemplate(editingTmpl.id, formData);
        showToast('התבנית עודכנה בהצלחה ✓', 'success');
      } else {
        await addTemplate(formData);
        showToast('התבנית נוספה בהצלחה ✓', 'success');
      }
    } catch {
      showToast('שגיאה בשמירה, נסה שוב', 'error');
      throw new Error('save failed'); // ✅ מונע סגירת Modal
    }
  };

  // ✅ handleDelete עם try/catch + Toast — תוקן מהגרסה של Gemini
  const handleDelete = async (templateId) => {
    try {
      await deleteTemplate(templateId);
      showToast('התבנית נמחקה', 'success');
    } catch {
      showToast('שגיאה במחיקה, נסה שוב', 'error');
    }
  };

  const handleOpenEdit = (tmpl) => { setEditingTmpl(tmpl); setModalOpen(true); };
  const handleOpenAdd  = ()     => { setEditingTmpl(null); setModalOpen(true); };
  const handleClose    = ()     => { setModalOpen(false);  setEditingTmpl(null); };

  return (
    <div className="p-4 md:p-8" dir="rtl">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-[#e5007e]" />
            תבניות הודעות חכמות
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            נהלי את הקשר עם הלקוחות בקלות וביעילות
          </p>
        </div>
        <button onClick={handleOpenAdd}
          className="bg-[#e5007e] hover:bg-[#b30062] text-white px-5 py-3 rounded-2xl
                     font-bold flex items-center justify-center gap-2
                     shadow-lg shadow-[#e5007e]/20 transition-colors">
          <Plus className="w-5 h-5" /> תבנית חדשה
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Sidebar ── */}
        <div className="lg:col-span-1 space-y-5">

          {/* Control Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border
                          border-gray-100 dark:border-gray-700 shadow-sm sticky top-24">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100
                           mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-[#e5007e]" /> פרטי לקוחה לתצוגה
            </h2>
            <div className="space-y-3">
              {/* Phone */}
              <div>
                <label className="text-xs font-semibold text-gray-500
                                  dark:text-gray-400 block mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#e5007e]" /> טלפון לשליחה
                </label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-0000000" type="tel" dir="ltr"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200
                             dark:border-gray-600 bg-gray-50 dark:bg-gray-700
                             text-gray-800 dark:text-gray-100 outline-none
                             focus:ring-2 focus:ring-[#e5007e] transition" />
                {phone && (
                  <p className="text-xs text-gray-400 mt-1 font-mono" dir="ltr">
                    → wa.me/{sanitizePhone(phone)}
                  </p>
                )}
              </div>
              {/* Name / Service / Time */}
              {[
                { label: 'שם הלקוחה',   val: name,    set: setName,    ph: 'שרה'           },
                { label: 'סוג הטיפול',  val: service, set: setService, ph: "לק ג'ל"         },
                { label: 'שעה / תאריך', val: time,    set: setTime,    ph: "יום ג׳ ב-10:00" },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <label className="text-xs font-semibold text-gray-500
                                    dark:text-gray-400 block mb-1">{label}</label>
                  <input value={val} onChange={(e) => set(e.target.value)}
                    placeholder={ph}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200
                               dark:border-gray-600 bg-gray-50 dark:bg-gray-700
                               text-gray-800 dark:text-gray-100 outline-none
                               focus:ring-2 focus:ring-[#e5007e] transition" />
                </div>
              ))}
              <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 leading-relaxed">
                💡 הפרטים מתעדכנים בתצוגה בזמן אמת ולא נשמרים במסד הנתונים.
              </p>
            </div>
          </div>

          {/* Filter */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border
                          border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100
                           mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#e5007e]" /> סינון לפי קטגוריה
            </h2>
            <div className="flex flex-col gap-1.5">
              {[{ id: 'all', label: 'כל התבניות' }, ...CATEGORIES].map((cat) => (
                <button key={cat.id} onClick={() => setFilter(cat.id)}
                  className={`text-right px-4 py-2 rounded-xl text-xs font-medium
                              transition-colors ${
                    filter === cat.id
                      ? 'bg-[#e5007e] text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  {cat.label}
                  {cat.id !== 'all' && (
                    <span className="mr-1 opacity-60">
                      ({templates.filter((t) => (t.categories ?? []).includes(cat.id)).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Templates Grid ── */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent
                              rounded-full animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl
                            border-2 border-dashed border-gray-200 dark:border-gray-700">
              <Hash className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {filter === 'all' ? 'אין תבניות עדיין' : 'לא נמצאו תבניות בקטגוריה זו'}
              </p>
              {filter === 'all' && (
                <button onClick={handleOpenAdd}
                  className="mt-3 text-sm text-[#e5007e] font-semibold hover:underline">
                  + הוסיפי תבנית ראשונה
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.id}
                  template={tmpl}
                  vars={vars}
                  phone={phone}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete} // ✅ עם try/catch
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TemplateModal
        isOpen={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        initialData={editingTmpl}
      />
    </div>
  );
}
