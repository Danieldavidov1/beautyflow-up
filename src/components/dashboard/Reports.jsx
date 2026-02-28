// src/components/dashboard/Reports.jsx
import {
  TrendingUp, TrendingDown, DollarSign, Download, BarChart3,
  Maximize2, X, Award, AlertTriangle, Activity, Filter, Globe, Smartphone,
} from 'lucide-react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart, Line, PieChart as RechartsPie, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useToast } from '../../context/ToastContext';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategoriesFirestore } from '../../hooks/useCategoriesFirestore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const MONTHS_HE_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];
const MONTHS_HE_FULL  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const FALLBACK_COLORS = ['#e5007e','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444','#f97316','#6b7280'];

// ── Tooltips ───────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-bold text-gray-700 dark:text-gray-200 mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600 dark:text-gray-300">{entry.name}</span>
          </div>
          <span className="font-bold" style={{ color: entry.color }}>
            {entry.name === 'תורים' ? entry.value : `₪${Number(entry.value).toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold" style={{ color: payload[0].payload.fill }}>{payload[0].name}</p>
      <p className="text-gray-700 dark:text-gray-200 font-bold">₪{Number(payload[0].value).toLocaleString()}</p>
      <p className="text-gray-400 dark:text-gray-500">{((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}%</p>
    </div>
  );
};

// ── PieChartCard ───────────────────────────────────────────────────────────
const PieChartCard = ({ title, data, onExpand, colorMap }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const dataWithTotal = data.map(d => ({ ...d, total }));
  const getColor = (name, idx) => colorMap?.[name] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  return (
    <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
      <div className="p-4 md:p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
        <button onClick={onExpand} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="הרחב">
          <Maximize2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
      <div className="p-4 md:p-5">
        <ResponsiveContainer width="100%" height={200}>
          <RechartsPie>
            <Pie data={dataWithTotal} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
              {dataWithTotal.map((entry, idx) => <Cell key={idx} fill={getColor(entry.name, idx)} />)}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
          </RechartsPie>
        </ResponsiveContainer>
        <div className="space-y-2 mt-3">
          {data.map((item, idx) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
            return (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(item.name, idx) }} />
                  <span className="text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-gray-900 dark:text-white">₪{item.value.toLocaleString()}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-left">{pct}%</span>
                </div>
              </div>
            );
          })}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between text-sm font-bold mt-2">
            <span className="text-gray-600 dark:text-gray-400">סה"כ</span>
            <span className="text-gray-900 dark:text-white">₪{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── ExpandedModal ──────────────────────────────────────────────────────────
const ExpandedModal = ({ title, data, onClose, colorMap }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const dataWithTotal = data.map(d => ({ ...d, total }));
  const getColor = (name, idx) => colorMap?.[name] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={280}>
            <RechartsPie>
              <Pie data={dataWithTotal} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={3} dataKey="value" stroke="none">
                {dataWithTotal.map((entry, idx) => <Cell key={idx} fill={getColor(entry.name, idx)} />)}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
            </RechartsPie>
          </ResponsiveContainer>
          <div className="mt-4 space-y-3">
            {data.map((item, idx) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
              const barWidth = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: getColor(item.name, idx) }} />
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">₪{item.value.toLocaleString()}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: getColor(item.name, idx) }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: getColor(item.name, idx) }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-gray-900 dark:bg-black rounded-xl flex justify-between items-center">
            <span className="text-white font-bold">סה"כ</span>
            <span className="text-white font-bold text-lg">₪{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── hook: appointments מ-Firestore ─────────────────────────────────────────
function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    const fetch = async () => {
      try {
        const q  = query(collection(db, 'appointments'), where('userId', '==', uid));
        const qs = await getDocs(q);
        setAppointments(qs.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('[useAppointments]', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { appointments, loading };
}

// ── Reports ────────────────────────────────────────────────────────────────
export default function Reports() {
  const { showToast } = useToast();
  const { transactions: incomes,   loading: loadingIncomes   } = useTransactions('income');
  const { transactions: expenses,  loading: loadingExpenses  } = useTransactions('expense');
  const { categories: expenseCategories, loading: catsExpenseLoading } = useCategoriesFirestore('expense');
  const { categories: incomeCategories,  loading: catsIncomeLoading  } = useCategoriesFirestore('income');
  const { appointments, loading: loadingAppointments } = useAppointments();

  const containerRef = useRef(null);

  const loading = loadingIncomes || loadingExpenses || catsExpenseLoading || catsIncomeLoading || loadingAppointments;

  const expenseColorMap = useMemo(() => Object.fromEntries(expenseCategories.map(c => [c.name, c.color])), [expenseCategories]);
  const incomeColorMap  = useMemo(() => Object.fromEntries(incomeCategories.map(c => [c.name,  c.color])), [incomeCategories]);

  useGSAP(() => {
    if (loading) return;
    gsap.from('.gsap-card', { y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out', clearProps: 'all' });
  }, { scope: containerRef, dependencies: [loading] });

  const [selectedYear,   setSelectedYear]   = useState(new Date().getFullYear());
  const [expandedChart,  setExpandedChart]  = useState(null);
  const [activeTab,      setActiveTab]      = useState('overview');
  const [monthlyFilter,  setMonthlyFilter]  = useState({ showOnlyActive: false, sortBy: 'month-asc' });

  useEffect(() => {
    setActiveTab('overview');
    setMonthlyFilter({ showOnlyActive: false, sortBy: 'month-asc' });
  }, [selectedYear]);

  const years = useMemo(() => {
    const s = new Set();
    [...incomes, ...expenses].forEach(i => s.add(new Date(i.date).getFullYear()));
    const arr = Array.from(s).sort((a, b) => b - a);
    if (!arr.length) arr.push(new Date().getFullYear());
    return arr;
  }, [incomes, expenses]);

  const monthlyData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const inc = incomes .filter(x => { const d = new Date(x.date); return d.getFullYear() === selectedYear && d.getMonth() === i; }).reduce((s, x) => s + x.amount, 0);
    const exp = expenses.filter(x => { const d = new Date(x.date); return d.getFullYear() === selectedYear && d.getMonth() === i; }).reduce((s, x) => s + x.amount, 0);
    return { month: i + 1, monthName: MONTHS_HE_SHORT[i], monthNameFull: MONTHS_HE_FULL[i], income: inc, expenses: exp, profit: inc - exp };
  }), [incomes, expenses, selectedYear]);

  const barData = useMemo(() => monthlyData.map(m => ({
    name: m.monthName,
    רווח:  m.profit >= 0 ? m.profit        : 0,
    הפסד:  m.profit <  0 ? Math.abs(m.profit) : 0,
  })), [monthlyData]);

  const expensesCategoryData = useMemo(() => {
    const map = {};
    expenses.forEach(e => { if (new Date(e.date).getFullYear() === selectedYear) map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses, selectedYear]);

  const incomesCategoryData = useMemo(() => {
    const map = {};
    incomes.forEach(i => { if (new Date(i.date).getFullYear() === selectedYear) map[i.category] = (map[i.category] || 0) + i.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [incomes, selectedYear]);

  const totalIncome   = useMemo(() => monthlyData.reduce((s, m) => s + m.income,   0), [monthlyData]);
  const totalExpenses = useMemo(() => monthlyData.reduce((s, m) => s + m.expenses, 0), [monthlyData]);
  const netProfit     = totalIncome - totalExpenses;
  const profitMargin  = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

  const activeMonths      = useMemo(() => monthlyData.filter(m => m.income > 0), [monthlyData]);
  const avgMonthlyIncome  = activeMonths.length ? Math.round(totalIncome / activeMonths.length) : 0;
  const monthsWithActivity = useMemo(() => monthlyData.filter(m => m.income > 0 || m.expenses > 0), [monthlyData]);
  const bestMonth  = useMemo(() => [...monthsWithActivity].sort((a, b) => b.profit - a.profit)[0], [monthsWithActivity]);
  const worstMonth = useMemo(() => [...monthsWithActivity].sort((a, b) => a.profit - b.profit)[0], [monthsWithActivity]);

  const prevYearData = useMemo(() => {
    const prevYear = selectedYear - 1;
    const prevIncome   = incomes .filter(x => new Date(x.date).getFullYear() === prevYear).reduce((s, x) => s + x.amount, 0);
    const prevExpenses = expenses.filter(x => new Date(x.date).getFullYear() === prevYear).reduce((s, x) => s + x.amount, 0);
    return { prevIncome, prevExpenses, prevProfit: prevIncome - prevExpenses };
  }, [incomes, expenses, selectedYear]);

  const incomeYoY = prevYearData.prevIncome > 0
    ? (((totalIncome - prevYearData.prevIncome) / prevYearData.prevIncome) * 100).toFixed(1) : null;

  const hasData = totalIncome > 0 || totalExpenses > 0;

  const filteredMonthlyData = useMemo(() => {
    let data = [...monthlyData];
    if (monthlyFilter.showOnlyActive) data = data.filter(m => m.income > 0 || m.expenses > 0);
    switch (monthlyFilter.sortBy) {
      case 'profit-desc':   return data.sort((a, b) => b.profit   - a.profit);
      case 'profit-asc':    return data.sort((a, b) => a.profit   - b.profit);
      case 'income-desc':   return data.sort((a, b) => b.income   - a.income);
      case 'expenses-desc': return data.sort((a, b) => b.expenses - a.expenses);
      default:              return data.sort((a, b) => a.month    - b.month);
    }
  }, [monthlyData, monthlyFilter]);

  const filteredTotalIncome   = useMemo(() => filteredMonthlyData.reduce((s, m) => s + m.income,   0), [filteredMonthlyData]);
  const filteredTotalExpenses = useMemo(() => filteredMonthlyData.reduce((s, m) => s + m.expenses, 0), [filteredMonthlyData]);
  const filteredNetProfit     = filteredTotalIncome - filteredTotalExpenses;

  // ── ✅ נתוני מקורות תורים ────────────────────────────────────────────────
  const sourcesData = useMemo(() => {
    const yearAppts = appointments.filter(a => {
      const y = a.date ? new Date(a.date).getFullYear() : null;
      return y === selectedYear;
    });

    const online = yearAppts.filter(a => a.source === 'online_booking');
    const manual = yearAppts.filter(a => a.source !== 'online_booking');

    const onlineRevenue = online.reduce((s, a) => s + (a.price || 0), 0);
    const manualRevenue = manual.reduce((s, a) => s + (a.price || 0), 0);

    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
      const o = online.filter(a => new Date(a.date).getMonth() === i);
      const m = manual.filter(a => new Date(a.date).getMonth() === i);
      return {
        monthName: MONTHS_HE_SHORT[i],
        אונליין: o.reduce((s, a) => s + (a.price || 0), 0),
        ידני:    m.reduce((s, a) => s + (a.price || 0), 0),
        תורים_אונליין: o.length,
        תורים_ידני:    m.length,
      };
    });

    const onlinePct = yearAppts.length > 0
      ? ((online.length / yearAppts.length) * 100).toFixed(1) : '0';

    return {
      total: yearAppts.length,
      onlineCount: online.length,
      manualCount: manual.length,
      onlineRevenue,
      manualRevenue,
      onlinePct,
      monthlyBreakdown,
    };
  }, [appointments, selectedYear]);

  const handleExportYearly = useCallback(() => {
    const data = [
      [`דוח שנתי ${selectedYear}`, '', '', ''],
      ['', '', '', ''],
      ['חודש', 'הכנסות', 'הוצאות', 'רווח'],
      ...monthlyData.map(m => [m.monthNameFull, `₪${m.income.toLocaleString()}`, `₪${m.expenses.toLocaleString()}`, `₪${m.profit.toLocaleString()}`]),
      ['', '', '', ''],
      ['סיכום', `₪${totalIncome.toLocaleString()}`, `₪${totalExpenses.toLocaleString()}`, `₪${netProfit.toLocaleString()}`],
      ['', '', '', ''],
      ['הוצאות לפי קטגוריה', '', '', ''],
      ...expensesCategoryData.map(e => [e.name, `₪${e.value.toLocaleString()}`, '', '']),
      ['', '', '', ''],
      ['הכנסות לפי קטגוריה', '', '', ''],
      ...incomesCategoryData.map(i => [i.name, `₪${i.value.toLocaleString()}`, '', '']),
    ];
    const csvContent = data.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `דוח_שנתי_${selectedYear}.csv`;
    link.click();
    showToast('הדוח ירד למחשב! 📊', 'success');
  }, [monthlyData, totalIncome, totalExpenses, netProfit, expensesCategoryData, incomesCategoryData, selectedYear, showToast]);

  const tabs = [
    { id: 'overview',   label: 'סקירה כללית' },
    { id: 'monthly',    label: 'ניתוח חודשי'  },
    { id: 'categories', label: 'קטגוריות'     },
    { id: 'sources',    label: '🌐 מקורות תורים' },
  ];

  return (
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors" ref={containerRef}>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">טוען דוחות...</p>
          </div>
        </div>
      ) : (
        <>
          {/* כותרת */}
          <div className="gsap-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">דוחות ותובנות 📊</h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 transition-colors">ניתוח מעמיק של הביצועים הכספיים שלך</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#e5007e] text-sm font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={handleExportYearly}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors whitespace-nowrap">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">ייצוא CSV</span>
              </button>
            </div>
          </div>

          {/* 4 כרטיסי סיכום */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                {incomeYoY !== null && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${Number(incomeYoY) >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {Number(incomeYoY) >= 0 ? '+' : ''}{incomeYoY}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">סך הכנסות</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">₪{totalIncome.toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">ממוצע ₪{avgMonthlyIncome.toLocaleString()} / חודש</p>
            </div>

            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg"><TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" /></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">סך הוצאות</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">₪{totalExpenses.toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{selectedYear}</p>
            </div>

            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                  <DollarSign className={`w-4 h-4 ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`} />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">רווח נקי</p>
              <p className={`text-xl md:text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {netProfit >= 0 ? '+' : ''}₪{netProfit.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{netProfit >= 0 ? 'עודף' : 'גירעון'}</p>
            </div>

            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"><BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" /></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">מרווח רווח</p>
              <p className="text-xl md:text-2xl font-bold text-purple-600 dark:text-purple-400">{profitMargin}%</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">מהכנסות</p>
            </div>
          </div>

          {/* החודש הטוב/גרוע */}
          {bestMonth && worstMonth && bestMonth.monthName !== worstMonth.monthName && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="gsap-card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 md:p-4 flex items-center gap-3 transition-colors">
                <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg flex-shrink-0"><Award className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
                <div>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">החודש הטוב ביותר 🏆</p>
                  <p className="font-bold text-green-900 dark:text-green-100">{bestMonth.monthNameFull} — ₪{bestMonth.profit.toLocaleString()}</p>
                </div>
              </div>
              <div className="gsap-card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 md:p-4 flex items-center gap-3 transition-colors">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" /></div>
                <div>
                  <p className="text-xs text-red-500 dark:text-red-400 font-medium">החודש הגרוע ביותר ⚠️</p>
                  <p className="font-bold text-red-900 dark:text-red-100">{worstMonth.monthNameFull} — ₪{worstMonth.profit.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="gsap-card flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6 overflow-x-auto transition-colors">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-max py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {!hasData && activeTab !== 'sources' ? (
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center transition-colors">
              <Activity className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">אין נתונים לשנה {selectedYear}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">הוסף הכנסות והוצאות כדי לראות דוחות</p>
            </div>
          ) : (
            <>
              {/* TAB: סקירה כללית */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 transition-colors">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400" />מגמות חודשיות {selectedYear}
                    </h2>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `₪${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={50} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                        <Line type="monotone" dataKey="income"   stroke="#10b981" strokeWidth={2.5} name="הכנסות" dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="expenses" stroke="#e5007e" strokeWidth={2.5} name="הוצאות" dot={{ r: 4, fill: '#e5007e' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 transition-colors">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />רווח נקי לפי חודש
                    </h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={barData} barGap={2} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `₪${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={50} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }} />
                        <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                        <Bar dataKey="רווח" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                        <Bar dataKey="הפסד" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={35} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* TAB: ניתוח חודשי */}
              {activeTab === 'monthly' && (
                <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                  <div className="p-3 md:p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">סינון ומיון</span>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <select value={monthlyFilter.sortBy} onChange={(e) => setMonthlyFilter(prev => ({ ...prev, sortBy: e.target.value }))}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs focus:ring-2 focus:ring-[#e5007e] transition-colors">
                        <option value="month-asc">סדר חודשים</option>
                        <option value="profit-desc">רווח (גבוה לנמוך)</option>
                        <option value="profit-asc">רווח (נמוך לגבוה)</option>
                        <option value="income-desc">הכנסות (גבוה לנמוך)</option>
                        <option value="expenses-desc">הוצאות (גבוה לנמוך)</option>
                      </select>
                      <button onClick={() => setMonthlyFilter(prev => ({ ...prev, showOnlyActive: !prev.showOnlyActive }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          monthlyFilter.showOnlyActive
                            ? 'bg-[#e5007e] text-white border-[#e5007e]'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}>
                        {monthlyFilter.showOnlyActive ? '✓ חודשים פעילים בלבד' : 'הצג חודשים פעילים בלבד'}
                      </button>
                    </div>
                  </div>

                  {/* כרטיסים - מובייל */}
                  <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredMonthlyData.map((m, idx) => {
                      const profit = m.income - m.expenses;
                      const hasActivity = m.income > 0 || m.expenses > 0;
                      return (
                        <div key={idx} className={`p-4 ${!hasActivity ? 'opacity-40' : ''}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-900 dark:text-white">{m.monthNameFull}</span>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${profit >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                              {profit >= 0 ? '+' : ''}₪{profit.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex gap-4 text-sm mb-2">
                            <span className="text-green-600 dark:text-green-400">↑ ₪{m.income.toLocaleString()}</span>
                            <span className="text-red-500 dark:text-red-400">↓ ₪{m.expenses.toLocaleString()}</span>
                          </div>
                          {hasActivity && m.income > 0 && (
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(Math.abs(profit / (m.income || 1)) * 100, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* טבלה - דסקטופ */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 transition-colors">
                        <tr>
                          <th className="text-right py-3.5 px-5 font-bold text-gray-700 dark:text-gray-300 text-sm">חודש</th>
                          <th className="text-right py-3.5 px-5 font-bold text-gray-700 dark:text-gray-300 text-sm">הכנסות</th>
                          <th className="text-right py-3.5 px-5 font-bold text-gray-700 dark:text-gray-300 text-sm">הוצאות</th>
                          <th className="text-right py-3.5 px-5 font-bold text-gray-700 dark:text-gray-300 text-sm">רווח נקי</th>
                          <th className="text-right py-3.5 px-5 font-bold text-gray-700 dark:text-gray-300 text-sm">סטטוס</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMonthlyData.map((m, idx) => {
                          const profit = m.income - m.expenses;
                          const hasActivity = m.income > 0 || m.expenses > 0;
                          return (
                            <tr key={idx} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!hasActivity ? 'opacity-40' : ''}`}>
                              <td className="py-3.5 px-5 font-medium text-gray-900 dark:text-white">{m.monthNameFull}</td>
                              <td className="py-3.5 px-5 font-bold text-green-600 dark:text-green-400">₪{m.income.toLocaleString()}</td>
                              <td className="py-3.5 px-5 font-bold text-red-500 dark:text-red-400">₪{m.expenses.toLocaleString()}</td>
                              <td className={`py-3.5 px-5 font-bold ${profit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'}`}>
                                {profit >= 0 ? '+' : ''}₪{profit.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-5">
                                {hasActivity ? (
                                  profit >= 0
                                    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium"><TrendingUp className="w-3 h-3" />רווח</span>
                                    : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium"><TrendingDown className="w-3 h-3" />הפסד</span>
                                ) : <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-700 transition-colors">
                        <tr>
                          <td className="py-3.5 px-5 font-bold text-gray-900 dark:text-white">סה"כ {monthlyFilter.showOnlyActive ? `(${filteredMonthlyData.length} חודשים)` : selectedYear}</td>
                          <td className="py-3.5 px-5 font-bold text-green-600 dark:text-green-400">₪{filteredTotalIncome.toLocaleString()}</td>
                          <td className="py-3.5 px-5 font-bold text-red-500 dark:text-red-400">₪{filteredTotalExpenses.toLocaleString()}</td>
                          <td className={`py-3.5 px-5 font-bold ${filteredNetProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'}`}>
                            {filteredNetProfit >= 0 ? '+' : ''}₪{filteredNetProfit.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-5 font-bold dark:text-gray-300">{filteredNetProfit >= 0 ? '✅ רווח' : '⚠️ הפסד'}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: קטגוריות */}
              {activeTab === 'categories' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  {expensesCategoryData.length > 0 ? (
                    <PieChartCard title="התפלגות הוצאות 💸" data={expensesCategoryData} onExpand={() => setExpandedChart('expense')} colorMap={expenseColorMap} />
                  ) : (
                    <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 transition-colors">
                      <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">אין הוצאות לשנה {selectedYear}</p>
                    </div>
                  )}
                  {incomesCategoryData.length > 0 ? (
                    <PieChartCard title="התפלגות הכנסות 💰" data={incomesCategoryData} onExpand={() => setExpandedChart('income')} colorMap={incomeColorMap} />
                  ) : (
                    <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 transition-colors">
                      <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">אין הכנסות לשנה {selectedYear}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ TAB: מקורות תורים */}
              {activeTab === 'sources' && (
                <div className="space-y-4 md:space-y-6">

                  {sourcesData.total === 0 ? (
                    <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center transition-colors">
                      <Globe className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">אין תורים לשנה {selectedYear}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">תורים שיאושרו יופיעו כאן עם פירוט המקור</p>
                    </div>
                  ) : (
                    <>
                      {/* 4 כרטיסי KPI */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

                        {/* סך תורים */}
                        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit mb-2">
                            <BarChart3 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">סך תורים</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{sourcesData.total}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{selectedYear}</p>
                        </div>

                        {/* תורים אונליין */}
                        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                          <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg w-fit mb-2">
                            <Globe className="w-4 h-4 text-[#e5007e]" />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">תורים אונליין</p>
                          <p className="text-2xl font-bold text-[#e5007e]">{sourcesData.onlineCount}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sourcesData.onlinePct}% מהסך</p>
                        </div>

                        {/* תורים ידניים */}
                        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit mb-2">
                            <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">תורים ידניים</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sourcesData.manualCount}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{(100 - Number(sourcesData.onlinePct)).toFixed(1)}% מהסך</p>
                        </div>

                        {/* הכנסה מאונליין */}
                        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg w-fit mb-2">
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">הכנסה מאונליין</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">₪{sourcesData.onlineRevenue.toLocaleString()}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">מתוך ₪{(sourcesData.onlineRevenue + sourcesData.manualRevenue).toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Progress bar אחוז אונליין */}
                      <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 transition-colors">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm">התפלגות מקורות תורים</h3>
                        <div className="space-y-4">

                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5 text-[#e5007e]" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">אונליין (דרך הלינק)</span>
                              </div>
                              <span className="text-sm font-bold text-[#e5007e]">{sourcesData.onlineCount} תורים · {sourcesData.onlinePct}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-[#e5007e] to-[#ff4da6] rounded-full transition-all duration-700"
                                style={{ width: `${sourcesData.onlinePct}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ידני (נוסף ישירות)</span>
                              </div>
                              <span className="text-sm font-bold text-blue-500">{sourcesData.manualCount} תורים · {(100 - Number(sourcesData.onlinePct)).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700"
                                style={{ width: `${(100 - Number(sourcesData.onlinePct)).toFixed(1)}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* אינסייט */}
                        {sourcesData.onlineCount > 0 && (
                          <div className="mt-4 p-3 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-xl">
                            <p className="text-xs text-[#e5007e] dark:text-pink-300 font-semibold">
                              🌐 הלינק האישי שלך הביא {sourcesData.onlineCount} תורים ב-{selectedYear} — שווי ₪{sourcesData.onlineRevenue.toLocaleString()}!
                            </p>
                          </div>
                        )}
                      </div>

                      {/* גרף עמודות חודשי — הכנסה */}
                      <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 transition-colors">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm md:text-base">
                          <BarChart3 className="w-4 h-4 text-gray-500" />הכנסה לפי מקור — לפי חודש
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={sourcesData.monthlyBreakdown} barGap={2} barCategoryGap="25%">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                            <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }}
                              tickFormatter={v => `₪${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={50} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                            <Bar dataKey="אונליין" fill="#e5007e" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            <Bar dataKey="ידני"    fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* גרף עמודות חודשי — כמות תורים */}
                      <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 transition-colors">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm md:text-base">
                          <Activity className="w-4 h-4 text-gray-500" />כמות תורים לפי מקור — לפי חודש
                        </h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={sourcesData.monthlyBreakdown} barGap={2} barCategoryGap="25%">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                            <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} width={30} />
                            <Tooltip cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 text-sm">
                                    <p className="font-bold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
                                    {payload.map((e, i) => (
                                      <div key={i} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                                          <span className="text-gray-600 dark:text-gray-300">{e.name}</span>
                                        </div>
                                        <span className="font-bold" style={{ color: e.color }}>{e.value} תורים</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                            <Bar dataKey="תורים_אונליין" name="אונליין" fill="#e5007e" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            <Bar dataKey="תורים_ידני"    name="ידני"    fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* טבלה מפורטת — דסקטופ בלבד */}
                      <div className="gsap-card hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm">פירוט חודשי</h3>
                        </div>
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th className="text-right py-3 px-5 text-sm font-bold text-gray-700 dark:text-gray-300">חודש</th>
                              <th className="text-right py-3 px-5 text-sm font-bold text-[#e5007e]">🌐 תורים אונליין</th>
                              <th className="text-right py-3 px-5 text-sm font-bold text-[#e5007e]">הכנסה אונליין</th>
                              <th className="text-right py-3 px-5 text-sm font-bold text-blue-600 dark:text-blue-400">📱 תורים ידניים</th>
                              <th className="text-right py-3 px-5 text-sm font-bold text-blue-600 dark:text-blue-400">הכנסה ידנית</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sourcesData.monthlyBreakdown.map((m, idx) => {
                              const hasAny = m['תורים_אונליין'] > 0 || m['תורים_ידני'] > 0;
                              return (
                                <tr key={idx} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!hasAny ? 'opacity-40' : ''}`}>
                                  <td className="py-3 px-5 font-medium text-gray-900 dark:text-white">{MONTHS_HE_FULL[idx]}</td>
                                  <td className="py-3 px-5 font-bold text-[#e5007e]">{m['תורים_אונליין']}</td>
                                  <td className="py-3 px-5 font-bold text-[#e5007e]">₪{m['אונליין'].toLocaleString()}</td>
                                  <td className="py-3 px-5 font-bold text-blue-600 dark:text-blue-400">{m['תורים_ידני']}</td>
                                  <td className="py-3 px-5 font-bold text-blue-600 dark:text-blue-400">₪{m['ידני'].toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-700">
                            <tr>
                              <td className="py-3 px-5 font-bold text-gray-900 dark:text-white">סה"כ</td>
                              <td className="py-3 px-5 font-bold text-[#e5007e]">{sourcesData.onlineCount}</td>
                              <td className="py-3 px-5 font-bold text-[#e5007e]">₪{sourcesData.onlineRevenue.toLocaleString()}</td>
                              <td className="py-3 px-5 font-bold text-blue-600 dark:text-blue-400">{sourcesData.manualCount}</td>
                              <td className="py-3 px-5 font-bold text-blue-600 dark:text-blue-400">₪{sourcesData.manualRevenue.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* כרטיסי מובייל — פירוט חודשי */}
                      <div className="gsap-card md:hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm">פירוט חודשי</h3>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {sourcesData.monthlyBreakdown.map((m, idx) => {
                            const hasAny = m['תורים_אונליין'] > 0 || m['תורים_ידני'] > 0;
                            if (!hasAny) return null;
                            return (
                              <div key={idx} className="p-4">
                                <p className="font-bold text-gray-900 dark:text-white text-sm mb-3">{MONTHS_HE_FULL[idx]}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-[#e5007e] font-semibold mb-1">🌐 אונליין</p>
                                    <p className="text-base font-bold text-[#e5007e]">{m['תורים_אונליין']} תורים</p>
                                    <p className="text-xs text-[#e5007e]">₪{m['אונליין'].toLocaleString()}</p>
                                  </div>
                                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-1">📱 ידני</p>
                                    <p className="text-base font-bold text-blue-600 dark:text-blue-400">{m['תורים_ידני']} תורים</p>
                                    <p className="text-xs text-blue-600 dark:text-blue-400">₪{m['ידני'].toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Modals */}
          {expandedChart === 'expense' && expensesCategoryData.length > 0 && (
            <ExpandedModal title="התפלגות הוצאות 💸" data={expensesCategoryData} onClose={() => setExpandedChart(null)} colorMap={expenseColorMap} />
          )}
          {expandedChart === 'income' && incomesCategoryData.length > 0 && (
            <ExpandedModal title="התפלגות הכנסות 💰" data={incomesCategoryData} onClose={() => setExpandedChart(null)} colorMap={incomeColorMap} />
          )}
        </>
      )}
    </div>
  );
}
