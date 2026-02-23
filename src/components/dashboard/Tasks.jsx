// src/dashboard/Tasks.jsx
import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import {
  CheckCircle2, Circle, Loader2, LayoutList, Plus, Trash2,
  Pencil, X, CalendarDays, Flag, Tag, ChevronDown, AlertTriangle,
} from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
// ✅ הוספתי את ה-ToastContext הגלובלי שלנו
import { useToast } from '../../context/ToastContext'; 

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'all',         label: 'הכל',     Icon: LayoutList   },
  { value: 'todo',        label: 'לביצוע',  Icon: Circle       },
  { value: 'in_progress', label: 'בתהליך',  Icon: Loader2      },
  { value: 'done',        label: 'הושלם',   Icon: CheckCircle2 },
];

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'דחוף',   color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/30'    },
  { value: 'medium', label: 'בינוני', color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { value: 'low',    label: 'נמוך',   color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-900/30'  },
];

const CATEGORY_OPTIONS = ['כללי', 'לקוחות', 'כספים', 'שיווק', 'אחר'];

const STATUS_NEXT = {
  todo:        { label: 'התחל ▶',       next: 'in_progress' },
  in_progress: { label: 'סמן הושלם ✓',  next: 'done'        },
  done:        { label: 'פתח מחדש ↩',   next: 'todo'        },
};

const EMPTY_FORM = {
  title: '', description: '', priority: 'medium',
  category: 'כללי', dueDate: '',
};

// ── Helper: format Firestore Timestamp or string to display date ───────────
function formatDate(dueDate) {
  if (!dueDate) return null;
  try {
    const d = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return null;
  }
}

// ── Sub-component: Priority Badge ──────────────────────────────────────────
function PriorityBadge({ priority }) {
  const opt = PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[1];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${opt.bg} ${opt.color}`}>
      <Flag className="w-3 h-3" />
      {opt.label}
    </span>
  );
}

// ── Sub-component: TaskCard ────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const cardRef = useRef(null);
  const nextStatus = STATUS_NEXT[task.status];

  // GSAP entrance animation
  useEffect(() => {
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
  }, []);

  const handleDelete = () => {
    gsap.to(cardRef.current, {
      opacity: 0, x: 40, duration: 0.25, ease: 'power2.in',
      onComplete: () => onDelete(task.id),
    });
  };

  const isDone = task.status === 'done';

  return (
    <div
      ref={cardRef}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Row 1: Priority + Title + Menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <PriorityBadge priority={task.priority} />
          <span className={`font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug
                            ${isDone ? 'line-through opacity-50' : ''}`}>
            {task.title}
          </span>
        </div>
        {/* Actions menu */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#e5007e] hover:bg-pink-50
                       dark:hover:bg-pink-900/20 transition-colors"
            title="עריכה"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                       dark:hover:bg-red-900/20 transition-colors"
            title="מחיקה"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Row 2: Category + Due Date + Status Button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Category badge */}
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                           bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <Tag className="w-3 h-3" />
            {task.category}
          </span>
          {/* Due date */}
          {formatDate(task.dueDate) && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <CalendarDays className="w-3 h-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        {/* Status transition button */}
        <button
          onClick={() => onStatusChange(task.id, nextStatus.next)}
          className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors
            ${isDone
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
              : 'bg-[#e5007e] text-white hover:bg-[#b30062]'
            }`}
        >
          {nextStatus.label}
        </button>
      </div>
    </div>
  );
}

// ── Sub-component: Task Modal ──────────────────────────────────────────────
function TaskModal({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef(null);
  const modalRef  = useRef(null);
  const isEditing = !!initialData?.id;

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({
          title:       initialData.title       ?? '',
          description: initialData.description ?? '',
          priority:    initialData.priority    ?? 'medium',
          category:    initialData.category    ?? 'כללי',
          dueDate:     initialData.dueDate?.toDate
            ? initialData.dueDate.toDate().toISOString().split('T')[0]
            : (initialData.dueDate ?? ''),
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, initialData]);

  // GSAP open animation
  useEffect(() => {
    if (!isOpen) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    gsap.fromTo(modalRef.current,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.4)' }
    );
  }, [isOpen]);

  const handleClose = () => {
    gsap.to(modalRef.current,  { opacity: 0, scale: 0.94, y: 10, duration: 0.2 });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, onComplete: onClose });
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        title:   form.title.trim(),
        dueDate: form.dueDate || null,
      });
      handleClose();
    } catch (err) {
      console.error('[TaskModal] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = `w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600
    bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100
    px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e5007e] transition`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {isEditing ? 'עריכת משימה' : 'משימה חדשה'}
          </h2>
          <button onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              כותרת <span className="text-[#e5007e]">*</span>
            </label>
            <input
              name="title" value={form.title} onChange={handleChange}
              placeholder="מה צריך לעשות?"
              className={inputCls} required autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              תיאור
            </label>
            <textarea
              name="description" value={form.description} onChange={handleChange}
              placeholder="פרטים נוספים (אופציונלי)..."
              rows={2} className={`${inputCls} resize-none`}
            />
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                עדיפות
              </label>
              <div className="relative">
                <select name="priority" value={form.priority} onChange={handleChange} className={inputCls}>
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4
                                        text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                קטגוריה
              </label>
              <div className="relative">
                <select name="category" value={form.category} onChange={handleChange} className={inputCls}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4
                                        text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              תאריך יעד
            </label>
            <input
              type="date" name="dueDate" value={form.dueDate} onChange={handleChange}
              className={inputCls}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         text-sm font-medium text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              ביטול
            </button>
            <button type="submit" disabled={saving || !form.title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#e5007e] text-white text-sm font-semibold
                         hover:bg-[#b30062] disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors">
              {saving ? 'שומר...' : isEditing ? 'שמור שינויים' : 'הוסף משימה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component: Tasks ──────────────────────────────────────────────────
export default function Tasks() {
  const { tasks, loading, addTask, updateTask, deleteTask, updateTaskStatus } = useTasks();
  // ✅ הוספנו קריאה ל-Hook הגלובלי של הטוסטים
  const { showToast } = useToast(); 

  const [activeTab,   setActiveTab]   = useState('all');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const listRef = useRef(null);

  // ── GSAP: animate list on tab change ──
  useEffect(() => {
    if (!listRef.current) return;
    gsap.fromTo(listRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    );
  }, [activeTab]);

  // ── Filtered tasks ──
  const filtered = activeTab === 'all'
    ? tasks
    : tasks.filter((t) => t.status === activeTab);

  // ── Summary stats ──
  const total     = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const highCount = tasks.filter((t) => t.priority === 'high' && t.status !== 'done').length;
  const progress  = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // ── Handlers ──
  const handleOpenAdd = () => { setEditingTask(null); setModalOpen(true); };
  const handleOpenEdit = (task) => { setEditingTask(task); setModalOpen(true); };
  const handleCloseModal = () => { setModalOpen(false); setEditingTask(null); };

  const handleSave = async (formData) => {
    try {
      if (editingTask?.id) {
        await updateTask(editingTask.id, formData);
        showToast('המשימה עודכנה בהצלחה ✓', 'success');
      } else {
        await addTask(formData);
        showToast('המשימה נוספה בהצלחה ✓', 'success');
      }
    } catch {
      showToast('שגיאה בשמירה, נסה שוב', 'error');
      throw new Error('save failed'); // מועבר חזרה ל-Modal למניעת סגירה
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await deleteTask(taskId);
      showToast('המשימה נמחקה', 'success');
    } catch {
      showToast('שגיאה במחיקה, נסה שוב', 'error');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await updateTaskStatus(taskId, newStatus);
    } catch {
      showToast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  // ── Render ──
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            ✅ ניהול משימות
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            עקוב אחר המשימות והמטלות שלך
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-[#e5007e] hover:bg-[#b30062]
                     text-white text-sm font-semibold px-4 py-2.5 rounded-xl
                     shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">משימה חדשה</span>
          <span className="sm:hidden">חדשה</span>
        </button>
      </div>

      {/* ── Summary Bar ── */}
      {total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200
                        dark:border-gray-700 p-4 mb-5 shadow-sm">
          <div className="flex items-center justify-between text-sm mb-2 flex-wrap gap-y-1">
            <span className="text-gray-600 dark:text-gray-400">
              סה"כ <span className="font-bold text-gray-800 dark:text-gray-100">{total}</span> משימות
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              הושלמו{' '}
              <span className="font-bold text-green-600">{doneCount}</span>
              {' / '}
              <span className="font-bold text-gray-800 dark:text-gray-100">{total}</span>
            </span>
            {highCount > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {highCount} דחופות
              </span>
            )}
            <span className="font-bold text-[#e5007e]">{progress}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(to left, #10b981, #e5007e)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Status Tabs ── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map(({ value, label, Icon }) => {
          const count = value === 'all'
            ? total
            : tasks.filter((t) => t.status === value).length;
          return (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg
                          transition-all whitespace-nowrap flex-1 justify-center
                          ${activeTab === value
                            ? 'bg-white dark:bg-gray-700 text-[#e5007e] shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full
                ${activeTab === value
                  ? 'bg-pink-100 dark:bg-pink-900/30 text-[#e5007e]'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Task List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#e5007e]" />
          <span className="text-sm">טוען משימות...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {activeTab === 'all' ? 'אין משימות עדיין' : 'אין משימות בקטגוריה זו'}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 text-sm text-[#e5007e] font-semibold hover:underline"
            >
              + הוסף משימה ראשונה
            </button>
          )}
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}

          {/* tfoot-style summary */}
          {filtered.length >= 2 && (
            <div className="mt-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl
                            border border-dashed border-gray-200 dark:border-gray-700
                            flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>מציג {filtered.length} משימות</span>
              <span>
                הושלמו{' '}
                <span className="font-bold text-green-600">
                  {filtered.filter((t) => t.status === 'done').length}
                </span>
                {' '}מתוך{' '}
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  {filtered.length}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      <TaskModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialData={editingTask}
      />
    </div>
  );
}