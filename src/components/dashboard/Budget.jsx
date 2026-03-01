import {
  Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle,
  DollarSign, Edit, Download, Lightbulb, Plus, Trash2, X,
  ChevronRight, ChevronLeft
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategoriesFirestore } from '../../hooks/useCategoriesFirestore';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const HEADER_HEIGHT = 73;
const FALLBACK_COLORS = [
  '#e5007e', '#ef4444', '#f97316', '#8b5cf6',
  '#3b82f6', '#10b981', '#f59e0b', '#6b7280'
];

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Budget() {
  const { showToast } = useToast();
  const { transactions: incomes, loading: loadingIncomes } = useTransactions('income');
  const { transactions: expenses, loading: loadingExpenses } = useTransactions('expense');
  const { categories: expenseCategories, loading: catsLoading } = useCategoriesFirestore('expense');

  const [budget, setBudget] = useState({ income: 0, expenses: 0 });
  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [loadingBudget, setLoadingBudget] = useState(true);

  // ✅ 1. currentMonth + currentYear כ-state במקום useMemo
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear,  setCurrentYear]  = useState(now.getFullYear());

  // האם החודש המוצג הוא החודש הנוכחי בפועל
  const isCurrentMonth = currentMonth === now.getMonth() && currentYear === now.getFullYear();

  const editSectionRef    = useRef(null);
  const categoryBudgetRef = useRef(null);
  const containerRef      = useRef(null);

  const categoryColorMap = useMemo(() =>
    Object.fromEntries(expenseCategories.map(c => [c.name, c.color])),
  [expenseCategories]);

  const getCategoryColor = useCallback((catName, idx) =>
    categoryColorMap[catName] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  [categoryColorMap]);

  // ✅ 2. ניווט חודשים
  const goToPrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // ✅ 4+5. טעינת תקציב עם העתקה חכמה מחודש קודם
  useEffect(() => {
    let unsubscribeBudget = () => {};
    let unsubscribeCats   = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeBudget();
      unsubscribeCats();

      if (!user) { setLoadingBudget(false); return; }

      // ── Budget ───────────────────────────────────────────────────────────
      const budgetQuery = query(
        collection(db, 'budgets'),
        where('userId', '==', user.uid),
        where('month',  '==', currentMonth + 1),
        where('year',   '==', currentYear)
      );

      unsubscribeBudget = onSnapshot(budgetQuery, async (snapshot) => {
        if (!snapshot.empty) {
          // מצאנו תקציב לחודש הזה — הצג אותו
          setBudget(snapshot.docs[0].data());
        } else if (isCurrentMonth) {
          // ✅ חודש נוכחי ואין תקציב — נסה להעתיק מהחודש הקודם
          const prevMonth = currentMonth === 0 ? 12 : currentMonth;
          const prevYear  = currentMonth === 0 ? currentYear - 1 : currentYear;
          const prevQuery = query(
            collection(db, 'budgets'),
            where('userId', '==', user.uid),
            where('month',  '==', prevMonth),
            where('year',   '==', prevYear)
          );
          const prevSnap = await getDocs(prevQuery);
          if (!prevSnap.empty) {
            const prevData = prevSnap.docs[0].data();
            const newBudget = { income: prevData.income || 0, expenses: prevData.expenses || 0 };
            await addDoc(collection(db, 'budgets'), {
              ...newBudget,
              userId:    user.uid,
              month:     currentMonth + 1,
              year:      currentYear,
              createdAt: new Date(),
              copiedFrom: `${prevMonth}/${prevYear}`,
            });
            showToast('התקציב הועתק אוטומטית מהחודש הקודם 📋', 'info');
            // ה-onSnapshot יירה שוב ויעדכן את ה-state
          } else {
            setBudget({ income: 0, expenses: 0 });
          }
        } else {
          setBudget({ income: 0, expenses: 0 });
        }
        setLoadingBudget(false);
      });

      // ── Category Budgets ──────────────────────────────────────────────────
      const catQuery = query(
        collection(db, 'categoryBudgets'),
        where('userId', '==', user.uid),
        where('month',  '==', currentMonth + 1),
        where('year',   '==', currentYear)
      );

      unsubscribeCats = onSnapshot(catQuery, async (snapshot) => {
        if (!snapshot.empty) {
          const cats = {};
          snapshot.docs.forEach(d => { const data = d.data(); cats[data.category] = data.amount; });
          setCategoryBudgets(cats);
        } else if (isCurrentMonth) {
          // ✅ חודש נוכחי ואין תקציבי קטגוריות — נסה להעתיק מהחודש הקודם
          const prevMonth = currentMonth === 0 ? 12 : currentMonth;
          const prevYear  = currentMonth === 0 ? currentYear - 1 : currentYear;
          const prevCatQuery = query(
            collection(db, 'categoryBudgets'),
            where('userId', '==', user.uid),
            where('month',  '==', prevMonth),
            where('year',   '==', prevYear)
          );
          const prevCatSnap = await getDocs(prevCatQuery);
          if (!prevCatSnap.empty) {
            const writes = prevCatSnap.docs.map(d => {
              const prev = d.data();
              return addDoc(collection(db, 'categoryBudgets'), {
                category:   prev.category,
                amount:     prev.amount,
                userId:     user.uid,
                month:      currentMonth + 1,
                year:       currentYear,
                createdAt:  new Date(),
                copiedFrom: `${prevMonth}/${prevYear}`,
              });
            });
            await Promise.all(writes);
            // ה-onSnapshot יירה שוב עם הנתונים החדשים
          } else {
            setCategoryBudgets({});
          }
        } else {
          setCategoryBudgets({});
        }
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeBudget();
      unsubscribeCats();
    };
  }, [currentMonth, currentYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = loadingIncomes || loadingExpenses || loadingBudget || catsLoading;

  useGSAP(() => {
    if (loading) return;
    gsap.from('.gsap-card', {
      y: 30, opacity: 0, duration: 0.5, stagger: 0.1,
      ease: 'power2.out', clearProps: 'all'
    });
  }, { scope: containerRef, dependencies: [loading] });

  const [showEdit,        setShowEdit]        = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [tempBudget,      setTempBudget]      = useState({ income: 0, expenses: 0 });
  const [newCatName,      setNewCatName]      = useState('');
  const [newCatAmount,    setNewCatAmount]    = useState('');
  const [editingCat,      setEditingCat]      = useState(null);

  const scrollToRef = useCallback((ref) => {
    if (!ref?.current) return;
    setTimeout(() => {
      const y = ref.current.getBoundingClientRect().top + window.pageYOffset - HEADER_HEIGHT - 20;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => { if (showEdit)        scrollToRef(editSectionRef);    }, [showEdit,        scrollToRef]);
  useEffect(() => { if (showAddCategory) scrollToRef(categoryBudgetRef); }, [showAddCategory, scrollToRef]);
  useEffect(() => { setTempBudget(budget); }, [budget]);

  useEffect(() => {
    if (showAddCategory) {
      const firstAvailable = expenseCategories.find(c => !categoryBudgets[c.name]);
      setNewCatName(firstAvailable?.name || expenseCategories[0]?.name || '');
    }
  }, [showAddCategory, expenseCategories, categoryBudgets]);

  // ✅ 3. סינון לפי חודש/שנה דינמיים
  const thisMonthExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [expenses, currentMonth, currentYear]);

  const thisMonthIncomes = useMemo(() =>
    incomes.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }), [incomes, currentMonth, currentYear]);

  const totalIncome   = useMemo(() => thisMonthIncomes.reduce( (s, i) => s + i.amount, 0), [thisMonthIncomes]);
  const totalExpenses = useMemo(() => thisMonthExpenses.reduce((s, e) => s + e.amount, 0), [thisMonthExpenses]);

  const incomeProgress  = budget.income   > 0 ? (totalIncome   / budget.income)   * 100 : 0;
  const expenseProgress = budget.expenses > 0 ? (totalExpenses / budget.expenses) * 100 : 0;
  const incomeLeft      = budget.income   - totalIncome;
  const expenseLeft     = budget.expenses - totalExpenses;

  const expensesByCategory = useMemo(() =>
    thisMonthExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {}),
  [thisMonthExpenses]);

  const incomesByCategory = useMemo(() =>
    thisMonthIncomes.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + i.amount; return acc; }, {}),
  [thisMonthIncomes]);

  const allTrackedCategories = useMemo(() => {
    const fromBudget   = Object.keys(categoryBudgets);
    const fromExpenses = Object.keys(expensesByCategory);
    return [...new Set([...fromBudget, ...fromExpenses])];
  }, [categoryBudgets, expensesByCategory]);

  const totalCategoryBudgeted = useMemo(() =>
    Object.values(categoryBudgets).reduce((s, v) => s + v, 0), [categoryBudgets]);

  const totalCategorySpent = useMemo(() =>
    allTrackedCategories.reduce((s, cat) => s + (expensesByCategory[cat] || 0), 0),
  [allTrackedCategories, expensesByCategory]);

  const smartTips = useMemo(() => {
    const tips = [];
    if (expenseProgress > 100) {
      const top = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a)[0];
      if (top) tips.push({ type: 'warning', text: `חרגת מהתקציב! נסה לצמצם ב-${top[0]} (₪${top[1].toLocaleString()})` });
    }
    if (incomeProgress < 50 && totalIncome > 0) {
      tips.push({ type: 'info', text: 'הגעת רק ל-50% מיעד ההכנסות. נסה לקדם עוד לקוחות!' });
    }
    if (expenseProgress < 70 && incomeProgress >= 100) {
      tips.push({ type: 'success', text: '🎉 מצוין! אתה מתחת לתקציב ההוצאות ועברת את יעד ההכנסות!' });
    }
    allTrackedCategories.forEach(cat => {
      const budgeted = categoryBudgets[cat];
      const spent    = expensesByCategory[cat] || 0;
      if (budgeted && spent > budgeted)
        tips.push({ type: 'warning', text: `קטגוריית "${cat}" חרגה ב-₪${(spent - budgeted).toLocaleString()}` });
    });
    return tips.slice(0, 3);
  }, [expenseProgress, incomeProgress, expensesByCategory, categoryBudgets, allTrackedCategories, totalIncome]);

  const handleSaveBudget = useCallback(async () => {
    if (tempBudget.income < 0 || tempBudget.expenses < 0) { showToast('אין להזין סכומים שליליים', 'error'); return; }
    if (!auth.currentUser) { showToast('יש להתחבר תחילה', 'error'); return; }
    try {
      const userId = auth.currentUser.uid;
      const q = query(collection(db, 'budgets'),
        where('userId', '==', userId),
        where('month',  '==', currentMonth + 1),
        where('year',   '==', currentYear)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { ...tempBudget, updatedAt: new Date() });
      } else {
        await addDoc(collection(db, 'budgets'), { ...tempBudget, userId, month: currentMonth + 1, year: currentYear, createdAt: new Date() });
      }
      setShowEdit(false);
      showToast('התקציב עודכן בהצלחה! 🎯', 'success');
    } catch (err) { console.error(err); showToast('שגיאה בשמירת התקציב', 'error'); }
  }, [tempBudget, showToast, currentMonth, currentYear]);

  const handleAddCategoryBudget = useCallback(async () => {
    if (!newCatName.trim() || !newCatAmount || Number(newCatAmount) <= 0) { showToast('נא לבחור קטגוריה ולהזין סכום תקין', 'error'); return; }
    if (categoryBudgets[newCatName]) { showToast(`תקציב לקטגוריה "${newCatName}" כבר קיים — ערוך אותו ישירות`, 'error'); return; }
    if (!auth.currentUser) { showToast('יש להתחבר תחילה', 'error'); return; }
    try {
      await addDoc(collection(db, 'categoryBudgets'), {
        category: newCatName.trim(), amount: Number(newCatAmount),
        userId: auth.currentUser.uid, month: currentMonth + 1, year: currentYear
      });
      setNewCatAmount(''); setShowAddCategory(false);
      showToast(`תקציב לקטגוריה "${newCatName.trim()}" נוסף! ✅`, 'success');
    } catch (err) { console.error(err); showToast('שגיאה בהוספת קטגוריה', 'error'); }
  }, [newCatName, newCatAmount, categoryBudgets, showToast, currentMonth, currentYear]);

  const handleUpdateCategoryBudget = useCallback(async (catName) => {
    if (!editingCat?.amount || Number(editingCat.amount) <= 0) { showToast('נא להזין סכום תקין', 'error'); return; }
    if (!auth.currentUser) { showToast('יש להתחבר תחילה', 'error'); return; }
    try {
      const q = query(collection(db, 'categoryBudgets'),
        where('userId', '==', auth.currentUser.uid),
        where('category', '==', catName),
        where('month',    '==', currentMonth + 1),
        where('year',     '==', currentYear)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { amount: Number(editingCat.amount), updatedAt: new Date() });
        setEditingCat(null);
        showToast('תקציב הקטגוריה עודכן! ✅', 'success');
      }
    } catch (err) { console.error(err); showToast('שגיאה בעדכון קטגוריה', 'error'); }
  }, [editingCat, showToast, currentMonth, currentYear]);

  const handleDeleteCategoryBudget = useCallback(async (catName) => {
    if (!auth.currentUser) { showToast('יש להתחבר תחילה', 'error'); return; }
    try {
      const q = query(collection(db, 'categoryBudgets'),
        where('userId', '==', auth.currentUser.uid),
        where('category', '==', catName),
        where('month',    '==', currentMonth + 1),
        where('year',     '==', currentYear)
      );
      const snap = await getDocs(q);
      if (!snap.empty) { await deleteDoc(snap.docs[0].ref); showToast(`תקציב "${catName}" הוסר`, 'success'); }
    } catch (err) { console.error(err); showToast('שגיאה במחיקת קטגוריה', 'error'); }
  }, [showToast, currentMonth, currentYear]);

  const handleExport = useCallback(() => {
    const data = [
      [`דוח תקציב - ${MONTHS_HE[currentMonth]} ${currentYear}`, '', ''],
      ['', '', ''],
      ['קטגוריה', 'מתוכנן', 'בפועל'],
      ['הכנסות',  `₪${budget.income?.toLocaleString()   || 0}`, `₪${totalIncome.toLocaleString()}`],
      ['הוצאות',  `₪${budget.expenses?.toLocaleString() || 0}`, `₪${totalExpenses.toLocaleString()}`],
      ['רווח נקי', `₪${((budget.income || 0) - (budget.expenses || 0)).toLocaleString()}`, `₪${(totalIncome - totalExpenses).toLocaleString()}`],
      ['', '', ''],
      ['פירוט הוצאות לפי קטגוריה', 'תקציב', 'בפועל'],
      ...allTrackedCategories.map(cat => [
        cat,
        categoryBudgets[cat] ? `₪${categoryBudgets[cat].toLocaleString()}` : 'לא הוגדר',
        `₪${(expensesByCategory[cat] || 0).toLocaleString()}`
      ]),
    ];
    const csvContent = data.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `דוח_תקציב_${currentMonth + 1}-${currentYear}.csv`;
    link.click();
    showToast('הדוח ירד למחשב! 📊', 'success');
  }, [budget, totalIncome, totalExpenses, categoryBudgets, expensesByCategory, allTrackedCategories, currentMonth, currentYear, showToast]);

  const getBarColor     = (p) => p >= 100 ? 'bg-red-500'   : p >= 80 ? 'bg-amber-400'  : 'bg-emerald-500';
  const getBarGradient  = (p) => p >= 100 ? 'from-red-500 to-rose-600' : p >= 80 ? 'from-amber-400 to-orange-500' : 'from-emerald-500 to-teal-500';
  const getStatusEmoji  = (p) => p >= 100 ? '🔴' : p >= 80 ? '🟡' : '🟢';

  const availableCategories = useMemo(() =>
    expenseCategories.filter(c => !categoryBudgets[c.name]),
  [expenseCategories, categoryBudgets]);

  return (
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors" ref={containerRef}>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">טוען תקציב מ-Firebase...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── כותרת + כפתורי פעולה ── */}
          <div className="gsap-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 md:mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">תקציב חודשי 🎯</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">תכנן ועקב אחר ההכנסות וההוצאות שלך</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors w-full sm:w-auto justify-center">
                <Download className="w-4 h-4" /> ייצוא CSV
              </button>
              <button onClick={() => { setTempBudget(budget || { income: 0, expenses: 0 }); setShowEdit(true); }}
                className="flex items-center gap-2 bg-[#e5007e] text-white px-4 sm:px-6 py-2.5 rounded-xl hover:bg-[#b30062] transition-colors font-medium text-sm w-full sm:w-auto justify-center">
                <Edit className="w-4 h-4" /> ערוך תקציב
              </button>
            </div>
          </div>

          {/* ✅ 2. Month Selector — בורר חודשים */}
          <div className="gsap-card flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-[#e5007e] hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
              title="חודש קודם">
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {MONTHS_HE[currentMonth]} {currentYear}
              </p>
              {isCurrentMonth && (
                <span className="text-xs font-medium text-[#e5007e] bg-pink-50 dark:bg-pink-900/30 px-2 py-0.5 rounded-full">
                  החודש הנוכחי
                </span>
              )}
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-[#e5007e] hover:bg-pink-50 dark:hover:bg-gray-700 transition-colors"
              title="חודש הבא">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* ── כרטיס סיכום ראשי ── */}
          <div className={`gsap-card rounded-2xl p-6 md:p-8 mb-6 shadow-xl text-white transition-colors ${
            totalIncome - totalExpenses >= 0
              ? 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600'
              : 'bg-gradient-to-br from-red-500 via-rose-500 to-pink-600'
          }`}>
            <div className="flex items-center gap-3 md:gap-4 mb-4">
              <div className="p-2 md:p-3 bg-white/20 rounded-xl">
                <Target className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-medium">רווח נקי בפועל</h2>
                <p className="text-xs md:text-sm text-white/80">{MONTHS_HE[currentMonth]} {currentYear}</p>
              </div>
            </div>
            <p className="text-3xl md:text-5xl font-bold mb-4">
              {totalIncome - totalExpenses >= 0 ? '+' : ''}₪{(totalIncome - totalExpenses).toLocaleString()}
            </p>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
              <div>
                <p className="text-white/70 text-xs mb-1">רווח מתוכנן</p>
                <p className="font-bold text-lg">₪{((budget?.income || 0) - (budget?.expenses || 0)).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-white/70 text-xs mb-1">בפועל</p>
                <p className="font-bold text-lg">₪{(totalIncome - totalExpenses).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-white/70 text-xs mb-1">סטטוס</p>
                <p className="font-bold text-lg">
                  {totalIncome - totalExpenses >= (budget?.income || 0) - (budget?.expenses || 0) ? '✅ מצוין' : '⚠️ שפר'}
                </p>
              </div>
            </div>
          </div>

          {/* ── טיפים חכמים ── */}
          {smartTips.length > 0 && (
            <div className="gsap-card space-y-2 mb-6">
              {smartTips.map((tip, idx) => (
                <div key={idx} className={`flex items-start gap-3 p-3 md:p-4 rounded-xl border-r-4 transition-colors ${
                  tip.type === 'warning' ? 'bg-red-50   dark:bg-red-900/30   border-red-400   dark:border-red-500'   :
                  tip.type === 'info'    ? 'bg-blue-50  dark:bg-blue-900/30  border-blue-400  dark:border-blue-500'  :
                                          'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-500'
                }`}>
                  <Lightbulb className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    tip.type === 'warning' ? 'text-red-500   dark:text-red-400'   :
                    tip.type === 'info'    ? 'text-blue-500  dark:text-blue-400'  : 'text-green-500 dark:text-green-400'
                  }`} />
                  <p className={`text-sm font-medium ${
                    tip.type === 'warning' ? 'text-red-800   dark:text-red-300'   :
                    tip.type === 'info'    ? 'text-blue-800  dark:text-blue-300'  : 'text-green-800 dark:text-green-300'
                  }`}>{tip.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── אזהרות ── */}
          {expenseProgress > 90 && expenseProgress <= 100 && (
            <div className="gsap-card bg-amber-50 dark:bg-amber-900/30 border-r-4 border-amber-400 dark:border-amber-500 p-4 mb-6 rounded-xl flex items-center gap-3 transition-colors">
              <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-300 text-sm">מתקרבים לתקציב! ⚠️</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">השתמשת ב-{expenseProgress.toFixed(0)}% מתקציב ההוצאות</p>
              </div>
            </div>
          )}
          {expenseProgress > 100 && (
            <div className="gsap-card bg-red-50 dark:bg-red-900/30 border-r-4 border-red-500 dark:border-red-600 p-4 mb-6 rounded-xl flex items-center gap-3 transition-colors">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900 dark:text-red-300 text-sm">חריגה מהתקציב! 🚨</p>
                <p className="text-xs text-red-700 dark:text-red-400">חרגת ב-₪{Math.abs(expenseLeft).toLocaleString()} מתקציב ההוצאות</p>
              </div>
            </div>
          )}

          {/* ── טופס עריכת תקציב כולל ── */}
          {showEdit && (
            <div ref={editSectionRef} className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm mb-6 border-2 border-[#e5007e] dark:border-pink-800 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">עריכת תקציב — {MONTHS_HE[currentMonth]} {currentYear}</h2>
                <button onClick={() => setShowEdit(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">יעד הכנסות (₪)</label>
                  <input type="number" value={tempBudget.income} min="0"
                    onChange={(e) => setTempBudget({ ...tempBudget, income: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">תקרת הוצאות (₪)</label>
                  <input type="number" value={tempBudget.expenses} min="0"
                    onChange={(e) => setTempBudget({ ...tempBudget, expenses: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleSaveBudget} className="flex-1 bg-[#e5007e] text-white py-2.5 rounded-lg hover:bg-[#b30062] font-medium text-sm">שמור</button>
                <button onClick={() => setShowEdit(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-sm">ביטול</button>
              </div>
            </div>
          )}

          {/* ── 2 כרטיסי Progress ── */}
          <div className="gsap-card grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* הכנסות */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border-2 border-green-100 dark:border-green-900/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">הכנסות</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">יעד: ₪{budget?.income?.toLocaleString() || 0}</p>
                  </div>
                </div>
                {incomeProgress >= 100
                  ? <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400" />
                  : <AlertCircle className="w-6 h-6 text-amber-400 dark:text-amber-500" />}
              </div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">₪{totalIncome.toLocaleString()}</span>
                <span className={`text-sm font-bold ${incomeProgress >= 100 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-500'}`}>
                  {incomeProgress.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                  incomeProgress >= 100 ? 'from-green-500 to-emerald-500' : 'from-blue-400 to-cyan-500'
                }`} style={{ width: `${Math.min(incomeProgress, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{incomeLeft >= 0 ? `נשאר להשיג: ₪${incomeLeft.toLocaleString()}` : `עודף: ₪${Math.abs(incomeLeft).toLocaleString()}`}</span>
                <span>{thisMonthIncomes.length} הכנסות</span>
              </div>
            </div>

            {/* הוצאות */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border-2 border-rose-100 dark:border-rose-900/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">הוצאות</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">תקרה: ₪{budget?.expenses?.toLocaleString() || 0}</p>
                  </div>
                </div>
                {expenseProgress <= 100
                  ? <CheckCircle className="w-6 h-6 text-green-500 dark:text-green-400" />
                  : <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />}
              </div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">₪{totalExpenses.toLocaleString()}</span>
                <span className={`text-sm font-bold ${expenseProgress > 100 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {expenseProgress.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                  expenseProgress > 100 ? 'from-red-500 to-rose-600' :
                  expenseProgress > 80  ? 'from-amber-400 to-orange-500' :
                                          'from-emerald-500 to-teal-500'
                }`} style={{ width: `${Math.min(expenseProgress, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{expenseLeft >= 0 ? `מותר עוד: ₪${expenseLeft.toLocaleString()}` : `חריגה: ₪${Math.abs(expenseLeft).toLocaleString()}`}</span>
                <span>{thisMonthExpenses.length} הוצאות</span>
              </div>
            </div>
          </div>

          {/* ── תקציב לפי קטגוריה ── */}
          <div ref={categoryBudgetRef} className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden transition-colors">
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-[#e5007e]" />
                תקציב לפי קטגוריה
              </h2>
              <button
                onClick={() => setShowAddCategory(prev => !prev)}
                disabled={availableCategories.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  showAddCategory ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400' : 'bg-[#e5007e] text-white hover:bg-[#b30062]'
                }`}>
                <Plus className="w-4 h-4" />
                {availableCategories.length === 0 ? 'כל הקטגוריות תוקצבו' : 'הוסף קטגוריה'}
              </button>
            </div>

            {showAddCategory && (
              <div className="p-4 md:p-5 bg-pink-50 dark:bg-pink-900/10 border-b border-pink-100 dark:border-pink-900/30">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">קטגוריה</label>
                    <select value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm">
                      {availableCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">תקציב חודשי (₪)</label>
                    <input type="number" value={newCatAmount} min="1" onChange={(e) => setNewCatAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategoryBudget()} placeholder="1000"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm" />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleAddCategoryBudget} className="flex-1 sm:flex-none bg-[#e5007e] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#b30062] font-medium">הוסף</button>
                    <button onClick={() => { setShowAddCategory(false); setNewCatAmount(''); }} className="flex-1 sm:flex-none bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 font-medium">ביטול</button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 md:p-5">
              {allTrackedCategories.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {allTrackedCategories.map((cat, idx) => {
                      const budgeted  = categoryBudgets[cat] || 0;
                      const spent     = expensesByCategory[cat] || 0;
                      const percent   = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
                      const isOver    = budgeted > 0 && spent > budgeted;
                      const catColor  = getCategoryColor(cat, idx);
                      return (
                        <div key={cat} className={`p-3 md:p-4 rounded-xl border transition-all ${
                          isOver ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                        }`}>
                          {editingCat?.name === cat ? (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                              <span className="font-medium text-gray-900 dark:text-white flex-shrink-0">{cat}</span>
                              <div className="flex gap-2 flex-1 w-full">
                                <input type="number" value={editingCat.amount} min="1"
                                  onChange={(e) => setEditingCat({ ...editingCat, amount: e.target.value })}
                                  className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-[#e5007e]" />
                                <button onClick={() => handleUpdateCategoryBudget(cat)} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-600 font-medium">✓</button>
                                <button onClick={() => setEditingCat(null)} className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500">✕</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{cat}</span>
                                  <span className="text-xs">{getStatusEmoji(budgeted > 0 ? (spent / budgeted) * 100 : 0)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setEditingCat({ name: cat, amount: categoryBudgets[cat] || '' })}
                                    className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  {categoryBudgets[cat] && (
                                    <button onClick={() => handleDeleteCategoryBudget(cat)}
                                      className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {budgeted > 0 && (
                                <>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${getBarColor(percent)} bg-gradient-to-r ${getBarGradient(percent)}`}
                                      style={{ width: `${percent}%` }} />
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <span>
                                      ₪{spent.toLocaleString()} / ₪{budgeted.toLocaleString()}
                                      {isOver && <span className="text-red-500 dark:text-red-400 font-medium mr-1"> (חריגה ₪{(spent - budgeted).toLocaleString()})</span>}
                                    </span>
                                    <span className={`font-medium ${isOver ? 'text-red-500 dark:text-red-400' : percent >= 80 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      {percent.toFixed(0)}%
                                    </span>
                                  </div>
                                </>
                              )}
                              {!budgeted && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500 dark:text-gray-400">הוצאה בפועל: ₪{spent.toLocaleString()}</span>
                                  <button onClick={() => setEditingCat({ name: cat, amount: '' })}
                                    className="text-[#e5007e] hover:text-[#ff4da6] hover:underline font-medium">
                                    + הגדר תקציב
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {Object.keys(categoryBudgets).length > 0 && (
                    <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">
                          סה"כ תקציב קטגוריות ({Object.keys(categoryBudgets).length} קטגוריות)
                        </span>
                        <div className="flex items-center gap-3 text-sm">
                          <span>
                            <span className="text-gray-500 dark:text-gray-400">בפועל: </span>
                            <span className={`font-bold ${totalCategorySpent > totalCategoryBudgeted ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              ₪{totalCategorySpent.toLocaleString()}
                            </span>
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">/</span>
                          <span>
                            <span className="text-gray-500 dark:text-gray-400">מתוכנן: </span>
                            <span className="font-bold text-gray-900 dark:text-white">₪{totalCategoryBudgeted.toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                          totalCategorySpent > totalCategoryBudgeted ? 'from-red-500 to-rose-600' :
                          totalCategorySpent / totalCategoryBudgeted > 0.8 ? 'from-amber-400 to-orange-500' :
                          'from-emerald-500 to-teal-500'
                        }`} style={{ width: `${Math.min(totalCategoryBudgeted > 0 ? (totalCategorySpent / totalCategoryBudgeted) * 100 : 0, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10">
                  <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">אין קטגוריות עדיין</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">הוסף קטגוריה כדי לעקוב אחרי התקציב שלך</p>
                </div>
              )}
            </div>
          </div>

          {/* ── פירוט הכנסות והוצאות ── */}
          <div className="gsap-card grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {Object.keys(incomesByCategory).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  הכנסות לפי קטגוריה
                </h2>
                <div className="space-y-3">
                  {Object.entries(incomesByCategory).sort(([, a], [, b]) => b - a).map(([cat, amount]) => {
                    const pct = totalIncome > 0 ? (amount / totalIncome) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat}</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            ₪{amount.toLocaleString()}
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-normal mr-1">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Object.keys(expensesByCategory).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#e5007e]" />
                  הוצאות לפי קטגוריה
                </h2>
                <div className="space-y-3">
                  {Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).map(([cat, amount]) => {
                    const pct      = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                    const budgeted = categoryBudgets[cat];
                    const isOver   = budgeted && amount > budgeted;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat}</span>
                          <span className={`text-sm font-bold ${isOver ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            ₪{amount.toLocaleString()}
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-normal mr-1">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full transition-all bg-gradient-to-r ${
                            isOver ? 'from-red-500 to-rose-500' : 'from-[#e5007e] to-pink-400'
                          }`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}