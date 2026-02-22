import {
  TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle,
  DollarSign, Activity
} from 'lucide-react';
import { useRef, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategoriesFirestore } from '../../hooks/useCategoriesFirestore';
import Reports from './Reports';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const MONTHS_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
const FALLBACK_COLORS = ['#e5007e', '#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#10b981'];

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 text-sm">
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-bold" style={{ color: payload[0].payload.fill }}>
        {payload[0].name}
      </p>
      <p className="text-gray-700 dark:text-gray-200">₪{Number(payload[0].value).toLocaleString()}</p>
      <p className="text-gray-500 dark:text-gray-400">{payload[0].payload.percent}%</p>
    </div>
  );
};

export default function Dashboard({ currentPage }) {
  const { transactions: incomes, loading: loadingIncomes } = useTransactions('income');
  const { transactions: expenses, loading: loadingExpenses } = useTransactions('expense');

  // ✅ כל ה-Hooks חייבים להיות לפני כל return — כולל זה!
  const { categories: expenseCategories, loading: catsLoading } = useCategoriesFirestore('expense');

  const containerRef = useRef(null);

  // ✅ categoryColorMap — חייב להיות לפני ה-return של Reports
  const categoryColorMap = useMemo(() =>
    Object.fromEntries(expenseCategories.map(c => [c.name, c.color])),
  [expenseCategories]);

  const getCategoryColor = useCallback((catName, index) => {
    return categoryColorMap[catName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  }, [categoryColorMap]);

  const isLoading = loadingIncomes || loadingExpenses || catsLoading;

  useGSAP(() => {
    if (isLoading) return;
    gsap.from('.gsap-card', {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out',
      clearProps: 'all'
    });
  }, { scope: containerRef, dependencies: [isLoading] });

  // ✅ return מוקדם — רק אחרי כל ה-Hooks!
  if (currentPage === 'reports') return <Reports />;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthIncomes = incomes.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const thisMonthExpenses = expenses.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalIncome = thisMonthIncomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = thisMonthExpenses.reduce((s, i) => s + i.amount, 0);
  const balance = totalIncome - totalExpenses;
  const isProfit = balance >= 0;

  const barData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(currentYear, currentMonth - (5 - i), 1);
    const m = date.getMonth();
    const y = date.getFullYear();
    const inc = incomes
      .filter(x => { const d = new Date(x.date); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((s, x) => s + x.amount, 0);
    const exp = expenses
      .filter(x => { const d = new Date(x.date); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((s, x) => s + x.amount, 0);
    return { name: MONTHS_HE[m], הכנסות: inc, הוצאות: exp };
  });

  const pieData = (() => {
    const map = {};
    thisMonthExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([name, value]) => ({
        name, value,
        percent: total > 0 ? ((value / total) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.value - a.value);
  })();

  const recentTransactions = [
    ...incomes.map(i => ({ ...i, type: 'income' })),
    ...expenses.map(e => ({ ...e, type: 'expense' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthIncome = incomes
    .filter(i => { const d = new Date(i.date); return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear; })
    .reduce((s, i) => s + i.amount, 0);

  const prevMonthExpense = expenses
    .filter(i => { const d = new Date(i.date); return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear; })
    .reduce((s, i) => s + i.amount, 0);

  const incomeChange = prevMonthIncome > 0
    ? ((totalIncome - prevMonthIncome) / prevMonthIncome * 100).toFixed(1) : null;
  const expenseChange = prevMonthExpense > 0
    ? ((totalExpenses - prevMonthExpense) / prevMonthExpense * 100).toFixed(1) : null;

  const hasAnyData = incomes.length > 0 || expenses.length > 0;

  return (
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors" ref={containerRef}>
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">טוען נתונים...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 md:mb-8 gsap-card">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">מסך הבית 🏠</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 transition-colors">סקירה כללית של הפיננסים שלך</p>
          </div>

          <div className={`gsap-card rounded-2xl p-6 md:p-8 mb-6 shadow-xl text-white transition-colors ${
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
                <p className="text-xs md:text-sm text-white/80">{MONTHS_HE[currentMonth]} {currentYear}</p>
              </div>
            </div>
            <p className="text-3xl md:text-5xl font-bold mb-2">
              {isProfit ? '+' : ''}₪{balance.toLocaleString()}
            </p>
            <p className="text-sm md:text-base text-white/90">
              {isProfit ? 'כל הכבוד! אתה ברווח החודש 💪' : 'שים לב - אתה בהפסד החודש'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
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
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">₪{totalIncome.toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{thisMonthIncomes.length} הכנסות</p>
            </div>

            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
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
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">₪{totalExpenses.toLocaleString()}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{thisMonthExpenses.length} הוצאות</p>
            </div>

            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${isProfit ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                  <DollarSign className={`w-5 h-5 ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
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
              <p className={`text-2xl md:text-3xl font-bold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isProfit ? '+' : ''}₪{balance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">רווח נקי החודש</p>
            </div>
          </div>

          {hasAnyData ? (
            <>
              <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 mb-6 transition-colors">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">הכנסות מול הוצאות - 6 חודשים אחרונים</h2>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={(v) => `₪${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={50} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }}
                      formatter={(value) => <span className="text-gray-600 dark:text-gray-400">{value}</span>} />
                    <Bar dataKey="הכנסות" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="הוצאות" fill="#e5007e" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
                <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-5 h-5 text-[#e5007e]" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">הוצאות לפי קטגוריה</h2>
                  </div>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                            paddingAngle={3} dataKey="value" stroke="none">
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name, index)} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-2">
                        {pieData.map((entry, index) => (
                          <div key={entry.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getCategoryColor(entry.name, index) }} />
                              <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{entry.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">₪{entry.value.toLocaleString()}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-left">{entry.percent}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                      <TrendingDown className="w-12 h-12 mb-2 opacity-30" />
                      <p className="text-sm">אין הוצאות החודש</p>
                    </div>
                  )}
                </div>

                <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">עסקאות אחרונות</h2>
                  </div>
                  {recentTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {recentTransactions.map((tx) => (
                        <div key={`${tx.type}-${tx.id}`}
                          className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${
                              tx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                            }`}>
                              {tx.type === 'income'
                                ? <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                : <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">
                                {tx.source}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {new Date(tx.date).toLocaleDateString('he-IL')} · {tx.category}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm font-bold flex-shrink-0 ${
                            tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {tx.type === 'income' ? '+' : '-'}₪{tx.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
                      <Activity className="w-12 h-12 mb-2 opacity-30" />
                      <p className="text-sm">אין עסקאות עדיין</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center transition-colors">
              <Wallet className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">ברוך הבא! 👋</h3>
              <p className="text-gray-500 dark:text-gray-400">התחל להוסיף הכנסות והוצאות כדי לראות את הסטטיסטיקות שלך כאן</p>
            </div>
          )}

          <div className="gsap-card bg-gradient-to-r from-[#e5007e] to-[#ff4da6] rounded-xl p-4 md:p-6 text-white shadow-md">
            <h3 className="text-lg md:text-xl font-bold mb-1">💡 טיפ פיננסי</h3>
            <p className="text-sm md:text-base text-white/90">
              {isProfit
                ? `מעולה! הרווחת ₪${balance.toLocaleString()} החודש. שקול להשקיע חלק מהעודף.`
                : `שים לב - הוצאת ₪${Math.abs(balance).toLocaleString()} יותר ממה שהכנסת. נסה לצמצם הוצאות.`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
