// src/components/dashboard/Dashboard.jsx
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle,
  DollarSign, Activity, CheckCircle2, Circle, Flag, ArrowLeft,
  Loader2, ChevronDown, Calendar, Users, Clock, Plus, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useTransactions }         from '../../hooks/useTransactions';
import { useCategoriesFirestore }  from '../../hooks/useCategoriesFirestore';
import { useTasks }                from '../../hooks/useTasks';
import { useAppointments }         from '../../hooks/useAppointments';
import { useCustomers }            from '../../hooks/useCustomers';
import Reports from './Reports';
import gsap from 'gsap';


const MONTHS_HE    = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];
const DAYS_HE      = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const FALLBACK_COLORS = ['#e5007e','#ef4444','#f97316','#8b5cf6','#3b82f6','#10b981'];


// ── helpers ────────────────────────────────────────────────────────────────
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


// ── STATUS config ──────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'todo',        label: 'לביצוע',  dot: 'bg-gray-400'   },
  { value: 'in_progress', label: 'בתהליך',  dot: 'bg-yellow-400' },
  { value: 'done',        label: 'הושלם ✓', dot: 'bg-green-500'  },
];


// ── Tooltips ───────────────────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                    rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: ₪{Number(entry.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};


const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                    rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold" style={{ color: payload[0].payload.fill }}>{payload[0].name}</p>
      <p className="text-gray-700 dark:text-gray-200">₪{Number(payload[0].value).toLocaleString()}</p>
      <p className="text-gray-500 dark:text-gray-400">{payload[0].payload.percent}%</p>
    </div>
  );
};


// ── StatusButton ───────────────────────────────────────────────────────────
function StatusButton({ task, updateTaskStatus }) {
  const [open,     setOpen]     = useState(false);
  const [updating, setUpdating] = useState(false);


  const handleSelect = async (newStatus) => {
    if (newStatus === task.status) { setOpen(false); return; }
    setUpdating(true);
    setOpen(false);
    try { await updateTaskStatus(task.id, newStatus); }
    catch (e) { console.error('[StatusButton]', e); }
    finally   { setUpdating(false); }
  };


  const current = STATUS_OPTIONS.find((s) => s.value === task.status) ?? STATUS_OPTIONS[0];


  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={updating}
        className="flex items-center gap-1 bg-[#e5007e] hover:bg-[#b30062]
                   disabled:opacity-60 text-white text-xs font-semibold
                   px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
        title="שינוי סטטוס"
      >
        {updating
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <><span className={`w-2 h-2 rounded-full ${current.dot} bg-white/80`} />
              <ChevronDown className="w-3 h-3" /></>
        }
      </button>


      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[110px]
                          bg-white dark:bg-gray-800 border border-gray-200
                          dark:border-gray-700 rounded-xl shadow-xl overflow-hidden"
               dir="rtl">
            {STATUS_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs
                            hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors
                            ${task.status === opt.value
                              ? 'font-bold text-[#e5007e]'
                              : 'text-gray-700 dark:text-gray-300'}`}>
                <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ── TasksWidget ────────────────────────────────────────────────────────────
function TasksWidget({ onNavigateToTasks }) {
  const { tasks, loading, updateTaskStatus } = useTasks();


  const urgentTasks = tasks.filter((t) => t.status !== 'done' && t.priority === 'high').slice(0, 3);
  const openCount   = tasks.filter((t) => t.status !== 'done').length;
  const doneCount   = tasks.filter((t) => t.status === 'done').length;
  const totalCount  = tasks.length;
  const progress    = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;


  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200
                    dark:border-gray-700 shadow-sm p-5 h-full transition-colors flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#e5007e]" />
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">משימות</h3>
          {openCount > 0 && (
            <span className="bg-[#e5007e] text-white text-xs font-bold
                             px-2 py-0.5 rounded-full">{openCount}</span>
          )}
        </div>
        <button onClick={onNavigateToTasks}
          className="flex items-center gap-1 text-xs text-[#e5007e]
                     font-semibold hover:underline">
          כל המשימות <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>


      {loading ? (
        <div className="flex justify-center py-4 flex-1 items-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#e5007e]" />
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-4 flex-1 flex flex-col justify-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">אין משימות עדיין</p>
          <button onClick={onNavigateToTasks}
            className="mt-2 text-xs text-[#e5007e] font-semibold hover:underline">
            + צור משימה ראשונה
          </button>
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500
                            dark:text-gray-400 mb-1.5">
              <span>{doneCount} מתוך {totalCount} בוצעו</span>
              <span className="font-semibold text-[#e5007e]">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700
                            rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(to left, #10b981, #e5007e)',
                }} />
            </div>
          </div>


          {urgentTasks.length > 0 ? (
            <div className="space-y-2 mt-auto">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400
                            mb-2 flex items-center gap-1">
                <Flag className="w-3 h-3 text-red-500" /> דחופות לטיפול
              </p>
              {urgentTasks.map((task) => (
                <div key={task.id}
                  className="flex items-center gap-2 p-2.5 rounded-lg
                             bg-red-50 dark:bg-red-900/10
                             border border-red-100 dark:border-red-900/30">
                  <Circle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-gray-300
                                   font-medium truncate flex-1">{task.title}</span>
                  <StatusButton task={task} updateTaskStatus={updateTaskStatus} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg mt-auto
                            bg-green-50 dark:bg-green-900/10
                            border border-green-100 dark:border-green-900/30">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                אין משימות דחופות — כל הכבוד! 🎉
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── UpcomingAppointmentsWidget ─────────────────────────────────────────────
function UpcomingAppointmentsWidget({ onNavigateToCalendar }) {
  const { appointments, loading } = useAppointments();


  const today = toDateStr(new Date());
 
  const upcoming = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'scheduled' && a.date >= today)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 3);
  }, [appointments, today]);


  const formatDate = (dateStr) => {
    const now      = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    if (dateStr === toDateStr(now)) return 'היום';
    if (dateStr === toDateStr(tomorrow)) return 'מחר';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `יום ${DAYS_HE[dt.getDay()]} ${d}.${m}`;
  };


  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200
                    dark:border-gray-700 shadow-sm p-5 h-full transition-colors flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#e5007e]" />
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">תורים קרובים</h3>
          {upcoming.length > 0 && (
            <span className="bg-[#e5007e] text-white text-xs font-bold
                             px-2 py-0.5 rounded-full">{upcoming.length}</span>
          )}
        </div>
        <button onClick={onNavigateToCalendar}
          className="flex items-center gap-1 text-xs text-[#e5007e]
                     font-semibold hover:underline">
          כל התורים <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>


      {loading ? (
        <div className="flex justify-center py-4 flex-1 items-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#e5007e]" />
        </div>
      ) : upcoming.length === 0 ? (
        <div className="text-center py-4 flex-1 flex flex-col justify-center">
          <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">אין תורים קרובים</p>
          <button onClick={onNavigateToCalendar}
            className="mt-2 text-xs text-[#e5007e] font-semibold hover:underline">
            + קבע תור ראשון
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 mt-auto">
          {upcoming.map((apt) => (
            <div key={apt.id}
              className="flex items-center gap-3 p-2.5 rounded-xl
                         bg-pink-50/60 dark:bg-[#e5007e]/5
                         border border-pink-100 dark:border-[#e5007e]/20
                         hover:border-[#e5007e]/40 transition-colors">
              <div className="shrink-0 text-center min-w-[42px]">
                <p className="text-xs font-bold text-[#e5007e]">{apt.startTime}</p>
                <p className="text-[10px] text-gray-400">{formatDate(apt.date)}</p>
              </div>
              <div className="w-px h-8 bg-pink-200 dark:bg-[#e5007e]/20 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {apt.title}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                  <Users className="w-2.5 h-2.5 shrink-0" />
                  {apt.customerName}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-[10px]
                              text-gray-400 dark:text-gray-500">
                <Clock className="w-2.5 h-2.5" />
                {apt.endTime}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── CustomersWidget ────────────────────────────────────────────────────────
function CustomersWidget({ onNavigateToCustomers }) {
  const { customers, loading } = useCustomers();
 
  const total = customers.length;
  const now = new Date();
  const newThisMonth = customers.filter((c) => {
    if (!c.createdAt) return false;
    const d = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;


  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200
                    dark:border-gray-700 shadow-sm p-5 h-full transition-colors flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#e5007e]" />
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">לקוחות</h3>
        </div>
        <button onClick={onNavigateToCustomers}
          className="flex items-center gap-1 text-xs text-[#e5007e]
                     font-semibold hover:underline">
          כל הלקוחות <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>


      {loading ? (
        <div className="flex justify-center py-4 flex-1 items-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#e5007e]" />
        </div>
      ) : (
        <div className="space-y-3 flex-1 flex flex-col justify-center">
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">לקוחות בסך הכל</p>
          </div>


          {newThisMonth > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg
                            bg-pink-50 dark:bg-[#e5007e]/10
                            border border-pink-100 dark:border-[#e5007e]/20">
              <TrendingUp className="w-3.5 h-3.5 text-[#e5007e] shrink-0" />
              <span className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-bold text-[#e5007e]">+{newThisMonth}</span> לקוחות חדשים החודש
              </span>
            </div>
          )}


          {total === 0 && (
            <div className="text-center py-2">
              <p className="text-xs text-gray-400 dark:text-gray-500">אין לקוחות עדיין</p>
              <button onClick={onNavigateToCustomers}
                className="mt-2 text-xs text-[#e5007e] font-semibold hover:underline">
                + הוסף לקוח ראשון
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── QuickActions ───────────────────────────────────────────────────────────
function QuickActions({ setCurrentPage }) {
  const actions = [
    { icon: Calendar, label: 'תור חדש',      action: () => setCurrentPage?.('calendar'),  cls: 'from-[#e5007e] to-[#ff4da6]' },
    { icon: Users,    label: 'לקוח חדש',     action: () => setCurrentPage?.('customers'), cls: 'from-purple-500 to-purple-400' },
    { icon: TrendingUp, label: 'הכנסה חדשה', action: () => setCurrentPage?.('income'),    cls: 'from-green-500 to-emerald-400' },
    { icon: Zap,      label: 'משימה חדשה',   action: () => setCurrentPage?.('tasks'),     cls: 'from-yellow-500 to-amber-400'  },
  ];


  return (
    <div className="gsap-card bg-white dark:bg-gray-800 rounded-2xl border border-gray-200
                    dark:border-gray-700 shadow-sm p-5 transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-[#e5007e]" />
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">פעולות מהירות</h3>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {actions.map(({ icon: Icon, label, action, cls }) => (
          <button key={label} onClick={action}
            className="flex flex-col items-center gap-2 p-3 rounded-xl
                       hover:scale-105 active:scale-95 transition-transform group">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cls}
                             flex items-center justify-center shadow-md
                             group-hover:shadow-lg transition-shadow`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400
                             text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


// ── Dashboard ──────────────────────────────────────────────────────────────
export default function Dashboard({ currentPage, setCurrentPage }) {
  const { transactions: incomes,  loading: loadingIncomes  } = useTransactions('income');
  const { transactions: expenses, loading: loadingExpenses } = useTransactions('expense');
  const { categories: expenseCategories, loading: catsLoading } = useCategoriesFirestore('expense');
  const containerRef = useRef(null);


  const categoryColorMap = useMemo(() =>
    Object.fromEntries(expenseCategories.map((c) => [c.name, c.color])),
  [expenseCategories]);


  const getCategoryColor = useCallback((catName, index) =>
    categoryColorMap[catName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  [categoryColorMap]);


  const isLoading = loadingIncomes || loadingExpenses || catsLoading;


  // ✅ תיקון: useEffect רגיל במקום useGSAP
  useEffect(() => {
    if (isLoading || !containerRef.current) return;
    gsap.fromTo('.gsap-card',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out', clearProps: 'all' }
    );
  }, [isLoading]);


  if (currentPage === 'reports') return <Reports />;


  const now          = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();


  const thisMonthIncomes  = incomes.filter((i) => {
    const d = new Date(i.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const thisMonthExpenses = expenses.filter((i) => {
    const d = new Date(i.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });


  const totalIncome   = thisMonthIncomes.reduce((s, i)  => s + i.amount, 0);
  const totalExpenses = thisMonthExpenses.reduce((s, i) => s + i.amount, 0);
  const balance       = totalIncome - totalExpenses;
  const isProfit      = balance >= 0;


  const barData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(currentYear, currentMonth - (5 - i), 1);
    const m = date.getMonth();
    const y = date.getFullYear();
    const inc = incomes.filter((x) => {
      const d = new Date(x.date); return d.getMonth() === m && d.getFullYear() === y;
    }).reduce((s, x) => s + x.amount, 0);
    const exp = expenses.filter((x) => {
      const d = new Date(x.date); return d.getMonth() === m && d.getFullYear() === y;
    }).reduce((s, x) => s + x.amount, 0);
    return { name: MONTHS_HE[m], הכנסות: inc, הוצאות: exp };
  });


  const pieData = (() => {
    const map = {};
    thisMonthExpenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([name, value]) => ({
        name, value,
        percent: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.value - a.value);
  })();


  const recentTransactions = [
    ...incomes.map((i)  => ({ ...i, type: 'income'  })),
    ...expenses.map((e) => ({ ...e, type: 'expense' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);


  const prevMonth     = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;


  const prevMonthIncome  = incomes.filter((i) => {
    const d = new Date(i.date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear;
  }).reduce((s, i) => s + i.amount, 0);
  const prevMonthExpense = expenses.filter((i) => {
    const d = new Date(i.date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear;
  }).reduce((s, i) => s + i.amount, 0);


  const incomeChange  = prevMonthIncome  > 0
    ? ((totalIncome   - prevMonthIncome)  / prevMonthIncome  * 100).toFixed(1) : null;
  const expenseChange = prevMonthExpense > 0
    ? ((totalExpenses - prevMonthExpense) / prevMonthExpense * 100).toFixed(1) : null;


  const hasAnyData = incomes.length > 0 || expenses.length > 0;


  return (
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors" ref={containerRef} dir="rtl">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent
                            rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">טוען נתונים...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Title ───────────────────────────────────────────────────── */}
          <div className="mb-6 md:mb-8 gsap-card">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              מסך הבית 🏠
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              סקירה כללית של הפיננסים שלך
            </p>
          </div>


          {/* ── Quick Actions ────────────────────────────────────────────── */}
          <div className="mb-6">
            <QuickActions setCurrentPage={setCurrentPage} />
          </div>


          {/* ── Balance hero ─────────────────────────────────────────────── */}
          <div className={`gsap-card rounded-2xl p-6 md:p-8 mb-6 shadow-xl text-white ${
            isProfit
              ? 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600'
              : 'bg-gradient-to-br from-red-500 via-rose-500 to-pink-600'
          }`}>
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-white/20 rounded-xl">
                <Wallet className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-medium">
                  {isProfit ? 'רווח נקי החודש 🎉' : 'הפסד החודש ⚠️'}
                </h2>
                <p className="text-xs md:text-sm text-white/80">
                  {MONTHS_HE[currentMonth]} {currentYear}
                </p>
              </div>
            </div>
            <p className="text-3xl md:text-5xl font-bold mb-2">
              {isProfit ? '+' : ''}₪{balance.toLocaleString()}
            </p>
            <p className="text-sm md:text-base text-white/90">
              {isProfit
                ? 'כל הכבוד! אתה ברווח החודש 💪'
                : 'שים לב - אתה בהפסד החודש'}
            </p>
          </div>


          {/* ── Stats grid — 4 columns ───────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
           
            {/* הכנסות */}
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5
                            shadow-sm border border-gray-200 dark:border-gray-700
                            transition-colors h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ArrowUpCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                {incomeChange !== null && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    Number(incomeChange) >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {Number(incomeChange) >= 0 ? '+' : ''}{incomeChange}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">סך הכנסות החודש</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                ₪{totalIncome.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {thisMonthIncomes.length} הכנסות
              </p>
            </div>


            {/* הוצאות */}
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5
                            shadow-sm border border-gray-200 dark:border-gray-700
                            transition-colors h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <ArrowDownCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                {expenseChange !== null && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    Number(expenseChange) <= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {Number(expenseChange) >= 0 ? '+' : ''}{expenseChange}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">סך הוצאות החודש</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                ₪{totalExpenses.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {thisMonthExpenses.length} הוצאות
              </p>
            </div>


            {/* יתרה */}
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5
                            shadow-sm border border-gray-200 dark:border-gray-700
                            transition-colors h-full">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${
                  isProfit
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-rose-100 dark:bg-rose-900/30'
                }`}>
                  <DollarSign className={`w-5 h-5 ${
                    isProfit
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`} />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  isProfit
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {isProfit ? 'עודף' : 'גירעון'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">יתרה נוכחית</p>
              <p className={`text-2xl md:text-3xl font-bold ${
                isProfit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {isProfit ? '+' : ''}₪{balance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">רווח נקי החודש</p>
            </div>


            {/* Tasks */}
            <div className="gsap-card h-full">
              <TasksWidget onNavigateToTasks={() => setCurrentPage?.('tasks')} />
            </div>
          </div>


          {/* ── Second row: Appointments + Customers ────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="gsap-card h-full">
              <UpcomingAppointmentsWidget
                onNavigateToCalendar={() => setCurrentPage?.('calendar')}
              />
            </div>
            <div className="gsap-card h-full">
              <CustomersWidget
                onNavigateToCustomers={() => setCurrentPage?.('customers')}
              />
            </div>
          </div>


          {/* ── Charts ──────────────────────────────────────────────────── */}
          {hasAnyData ? (
            <>
              <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm
                              border border-gray-200 dark:border-gray-700
                              p-4 md:p-6 mb-6 transition-colors">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    הכנסות מול הוצאות — 6 חודשים אחרונים
                  </h2>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"
                      strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={(v) => `₪${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                      width={50} />
                    <Tooltip content={<CustomBarTooltip />}
                      cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }}
                      formatter={(value) =>
                        <span className="text-gray-600 dark:text-gray-400">{value}</span>
                      } />
                    <Bar dataKey="הכנסות" fill="#10b981" radius={[6,6,0,0]} maxBarSize={40} />
                    <Bar dataKey="הוצאות" fill="#e5007e" radius={[6,6,0,0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>


              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
               
                {/* Pie */}
                <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm
                                border border-gray-200 dark:border-gray-700
                                p-4 md:p-6 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-5 h-5 text-[#e5007e]" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      הוצאות לפי קטגוריה
                    </h2>
                  </div>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%"
                            innerRadius={55} outerRadius={85}
                            paddingAngle={3} dataKey="value" stroke="none">
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`}
                                fill={getCategoryColor(entry.name, index)} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-2">
                        {pieData.map((entry, index) => (
                          <div key={entry.name}
                            className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getCategoryColor(entry.name, index) }} />
                              <span className="text-gray-700 dark:text-gray-300
                                               truncate max-w-[120px]">{entry.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                ₪{entry.value.toLocaleString()}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500
                                               w-10 text-left">{entry.percent}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48
                                    text-gray-400 dark:text-gray-500">
                      <TrendingDown className="w-12 h-12 mb-2 opacity-30" />
                      <p className="text-sm">אין הוצאות החודש</p>
                    </div>
                  )}
                </div>


                {/* Recent transactions */}
                <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm
                                border border-gray-200 dark:border-gray-700
                                p-4 md:p-6 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      עסקאות אחרונות
                    </h2>
                  </div>
                  {recentTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {recentTransactions.map((tx) => (
                        <div key={`${tx.type}-${tx.id}`}
                          className="flex items-center justify-between py-2.5
                                     border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${
                              tx.type === 'income'
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                              {tx.type === 'income'
                                ? <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                : <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white
                                           truncate max-w-[140px]">{tx.source}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {new Date(tx.date).toLocaleDateString('he-IL')} · {tx.category}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm font-bold flex-shrink-0 ${
                            tx.type === 'income'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {tx.type === 'income' ? '+' : '-'}₪{tx.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48
                                    text-gray-400 dark:text-gray-500">
                      <Activity className="w-12 h-12 mb-2 opacity-30" />
                      <p className="text-sm">אין עסקאות עדיין</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm
                            border border-gray-200 dark:border-gray-700
                            p-12 text-center transition-colors">
              <Wallet className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                ברוך הבא! 👋
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                התחל להוסיף הכנסות והוצאות כדי לראות את הסטטיסטיקות שלך כאן
              </p>
            </div>
          )}


          {/* ── Financial tip ────────────────────────────────────────────── */}
          <div className="gsap-card bg-gradient-to-r from-[#e5007e] to-[#ff4da6]
                          rounded-xl p-4 md:p-6 text-white shadow-md">
            <h3 className="text-lg md:text-xl font-bold mb-1">💡 טיפ פיננסי</h3>
            <p className="text-sm md:text-base text-white/90">
              {isProfit
                ? `מעולה! הרווחת ₪${balance.toLocaleString()} החודש. שקול להשקיע חלק מהעודף.`
                : `שים לב - הוצאת ₪${Math.abs(balance).toLocaleString()} יותר ממה שהכנסת. נסה לצמצם הוצאות.`
              }
            </p>
          </div>
        </>
      )}
    </div>
  );
}



