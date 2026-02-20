import { TrendingUp, Plus, Trash2, Edit2, Search, SlidersHorizontal, X, ChevronDown, Tag, GripVertical, Download, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAppContext } from '../../context/AppContext';

// ✅ ייבוא GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const HEADER_HEIGHT = 73;

const DEFAULT_CATEGORIES = [
  { name: 'משכורת', color: '#10b981' },
  { name: 'עבודה נוספת', color: '#3b82f6' },
  { name: 'מתנה', color: '#f59e0b' },
  { name: 'השקעה', color: '#8b5cf6' },
  { name: 'אחר', color: '#6b7280' },
];

export default function Income() {
  const { showToast } = useToast();
  const { state: { incomes }, dispatch } = useAppContext(); 
  
  const formRef = useRef(null);
  const categoryRef = useRef(null);
  const containerRef = useRef(null); // ✅ רפרנס חדש בשביל האנימציה

  // ✅ הפעלת אנימציית הכניסה
  useGSAP(() => {
    gsap.from('.gsap-card', {
      y: 30,             // החלקה עדינה מלמטה
      opacity: 0,        // מתחיל שקוף
      duration: 0.5,     // מהירות האנימציה
      stagger: 0.1,      // עיכוב קל בין כרטיס לכרטיס
      ease: 'power2.out',// תנועה טבעית
      clearProps: 'all'  // מנקה סטייל כדי לא לדרוס עיצובים רספונסיביים/מצב לילה
    });
  }, { scope: containerRef });

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('incomeCategories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [showForm, setShowForm] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10b981');
  const [editingCat, setEditingCat] = useState(null);

  const [formData, setFormData] = useState({
    source: '',
    amount: '',
    category: 'משכורת',
    date: new Date().toISOString().split('T')[0]
  });

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    amountFrom: '',
    amountTo: '',
    sortBy: 'date-desc'
  });

  const scrollToRef = useCallback((ref) => {
    if (!ref?.current) return;
    setTimeout(() => {
      const y = ref.current.getBoundingClientRect().top + window.pageYOffset - HEADER_HEIGHT - 20;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    if (showCategoryManager) scrollToRef(categoryRef);
  }, [showCategoryManager, scrollToRef]);

  useEffect(() => {
    if (showForm) scrollToRef(formRef);
  }, [showForm, scrollToRef]);

  useEffect(() => {
    localStorage.setItem('incomeCategories', JSON.stringify(categories));
  }, [categories]);

  const categoryColorMap = useMemo(() => {
    return Object.fromEntries(categories.map(c => [c.name, c.color]));
  }, [categories]);

  const getCategoryColor = useCallback((catName) => {
    return categoryColorMap[catName] ?? '#6b7280';
  }, [categoryColorMap]);

  const stats = useMemo(() => {
    if (incomes.length === 0) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonthIncomes = incomes.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const prevMonthIncomes = incomes.filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear;
    });

    const thisMonthTotal = thisMonthIncomes.reduce((s, i) => s + i.amount, 0);
    const prevMonthTotal = prevMonthIncomes.reduce((s, i) => s + i.amount, 0);

    const avgMonthly = (() => {
      const monthMap = {};
      incomes.forEach(i => {
        const d = new Date(i.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthMap[key] = (monthMap[key] || 0) + i.amount;
      });
      const totals = Object.values(monthMap);
      return totals.length ? totals.reduce((s, v) => s + v, 0) / totals.length : 0;
    })();

    const maxIncome = incomes.reduce((max, i) => i.amount > max.amount ? i : max, incomes[0]);

    let changePercent = null;
    let changeDir = 'same';
    if (prevMonthTotal > 0) {
      changePercent = ((thisMonthTotal - prevMonthTotal) / prevMonthTotal * 100).toFixed(1);
      changeDir = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'same';
    }

    return { thisMonthTotal, prevMonthTotal, avgMonthly, maxIncome, changePercent, changeDir };
  }, [incomes]);

  const handleDragStart = useCallback((index) => setDragIndex(index), []);
  const handleDragOver = useCallback((e, index) => { e.preventDefault(); setDragOver(index); }, []);
  const handleDragEnd = useCallback(() => { setDragIndex(null); setDragOver(null); }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const updated = [...categories];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setCategories(updated);
    setDragIndex(null);
    setDragOver(null);
    showToast('סדר הקטגוריות עודכן! 🔃', 'success');
  }, [dragIndex, categories, showToast]);

  const handleAddCategory = useCallback(() => {
    if (!newCatName.trim()) return;
    if (categories.find(c => c.name === newCatName.trim())) {
      showToast('קטגוריה עם שם זה כבר קיימת', 'error');
      return;
    }
    setCategories(prev => [...prev, { name: newCatName.trim(), color: newCatColor }]);
    setNewCatName('');
    setNewCatColor('#10b981');
    showToast('קטגוריה נוספה! 🎨', 'success');
  }, [newCatName, newCatColor, categories, showToast]);

  const handleUpdateCategory = useCallback(() => {
    if (!editingCat) return;
    const oldName = categories[editingCat.index].name;
    setCategories(prev => prev.map((c, i) =>
      i === editingCat.index ? { name: editingCat.name, color: editingCat.color } : c
    ));
    
    if (oldName !== editingCat.name) {
      const updatedIncomes = incomes.map(inc =>
        inc.category === oldName ? { ...inc, category: editingCat.name } : inc
      );
      dispatch({ type: 'SET_INCOMES', payload: updatedIncomes });
    }
    
    setEditingCat(null);
    showToast('קטגוריה עודכנה! ✅', 'success');
  }, [editingCat, categories, incomes, dispatch, showToast]);

  const handleDeleteCategory = useCallback((index) => {
    const catName = categories[index].name;
    if (incomes.some(inc => inc.category === catName)) {
      showToast('לא ניתן למחוק קטגוריה בשימוש!', 'error');
      return;
    }
    setCategories(prev => prev.filter((_, i) => i !== index));
    showToast('קטגוריה נמחקה', 'success');
  }, [categories, incomes, showToast]);

  const filteredIncomes = useMemo(() => {
    let filtered = [...incomes];
    if (filters.search) filtered = filtered.filter(i => i.source.toLowerCase().includes(filters.search.toLowerCase()));
    if (filters.category) filtered = filtered.filter(i => i.category === filters.category);
    if (filters.dateFrom) filtered = filtered.filter(i => i.date >= filters.dateFrom);
    if (filters.dateTo) filtered = filtered.filter(i => i.date <= filters.dateTo);
    if (filters.amountFrom) filtered = filtered.filter(i => i.amount >= Number(filters.amountFrom));
    if (filters.amountTo) filtered = filtered.filter(i => i.amount <= Number(filters.amountTo));
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date-desc': return new Date(b.date) - new Date(a.date);
        case 'date-asc': return new Date(a.date) - new Date(b.date);
        case 'amount-desc': return b.amount - a.amount;
        case 'amount-asc': return a.amount - b.amount;
        default: return 0;
      }
    });
    return filtered;
  }, [incomes, filters]);

  const totalIncome = useMemo(() =>
    filteredIncomes.reduce((sum, i) => sum + i.amount, 0),
  [filteredIncomes]);

  const activeFiltersCount = useMemo(() =>
    [filters.category, filters.dateFrom, filters.dateTo, filters.amountFrom, filters.amountTo]
      .filter(Boolean).length,
  [filters]);

  const handleExportCSV = useCallback(() => {
    if (filteredIncomes.length === 0) {
      showToast('אין נתונים לייצוא', 'error');
      return;
    }
    const headers = ['מקור', 'קטגוריה', 'סכום (₪)', 'תאריך'];
    const rows = filteredIncomes.map(i => [
      `"${i.source}"`,
      `"${i.category}"`,
      i.amount,
      new Date(i.date).toLocaleDateString('he-IL')
    ]);
    const total = filteredIncomes.reduce((s, i) => s + i.amount, 0);
    rows.push(['', '"סה"כ"', total, '']);

    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `הכנסות_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`יוצאו ${filteredIncomes.length} הכנסות ✅`, 'success');
  }, [filteredIncomes, showToast]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!formData.source || !formData.amount) {
      showToast('נא למלא את כל השדות החובה', 'error');
      return;
    }
    
    if (editingId) {
      dispatch({
        type: 'UPDATE_INCOME',
        payload: { ...formData, id: editingId, amount: Number(formData.amount) }
      });
      showToast('ההכנסה עודכנה בהצלחה! ✅', 'success');
    } else {
      dispatch({
        type: 'ADD_INCOME',
        payload: { id: Date.now(), ...formData, amount: Number(formData.amount) }
      });
      showToast('ההכנסה נוספה בהצלחה! 💰', 'success');
    }
    
    setFormData({ source: '', amount: '', category: categories[0]?.name || 'משכורת', date: new Date().toISOString().split('T')[0] });
    setShowForm(false);
    setEditingId(null);
  }, [formData, editingId, categories, dispatch, showToast]);

  const handleEdit = useCallback((income) => {
    setFormData({ source: income.source, amount: income.amount.toString(), category: income.category, date: income.date });
    setEditingId(income.id);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback((id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק הכנסה זו?')) {
      dispatch({ type: 'DELETE_INCOME', payload: id });
      showToast('ההכנסה נמחקה בהצלחה', 'success');
    }
  }, [dispatch, showToast]);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', category: '', dateFrom: '', dateTo: '', amountFrom: '', amountTo: '', sortBy: 'date-desc' });
    showToast('הסינונים נוקו! 🔄', 'success');
  }, [showToast]);

  const handleNewIncome = useCallback(() => {
    setEditingId(null);
    setFormData({ source: '', amount: '', category: categories[0]?.name || 'משכורת', date: new Date().toISOString().split('T')[0] });
    setShowForm(true);
    if (showForm && formRef.current) scrollToRef(formRef);
  }, [categories, showForm, scrollToRef]);

  return (
    // ✅ הוספנו את ה-ref של האנימציה לקונטיינר הראשי
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors" ref={containerRef}>

      {/* כותרת */}
      <div className="gsap-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">הכנסות 💰</h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 transition-colors">עקוב אחרי כל ההכנסות שלך</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {incomes.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors w-full sm:w-auto justify-center"
            >
              <Download className="w-4 h-4" />
              ייצוא CSV
            </button>
          )}
          <button
            onClick={() => setShowCategoryManager(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-colors w-full sm:w-auto justify-center ${
              showCategoryManager
                ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 text-purple-700 dark:text-purple-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Tag className="w-4 h-4" />
            קטגוריות
          </button>
          <button
            onClick={handleNewIncome}
            className="flex items-center gap-2 bg-green-600 text-white px-4 sm:px-6 py-2.5 md:py-3 rounded-xl hover:bg-green-700 transition-colors font-medium text-sm md:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            הכנסה חדשה
          </button>
        </div>
      </div>

      {/* כרטיס סיכום ראשי */}
      <div className="gsap-card bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-2xl p-6 md:p-8 mb-6 shadow-xl text-white">
        <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
          <div className="p-2 md:p-3 bg-white/20 rounded-xl">
            <TrendingUp className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-medium">סך הכנסות מסוננות</h2>
            <p className="text-xs md:text-sm text-white/80">{filteredIncomes.length} הכנסות</p>
          </div>
        </div>
        <p className="text-3xl md:text-5xl font-bold">₪{totalIncome.toLocaleString()}</p>
      </div>

      {/* כרטיסי סטטיסטיקה */}
      {stats && (
        <div className="gsap-card grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">החודש הנוכחי</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              ₪{stats.thisMonthTotal.toLocaleString()}
            </p>
            {stats.changePercent !== null && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${
                stats.changeDir === 'up' ? 'text-green-600 dark:text-green-400' :
                stats.changeDir === 'down' ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {stats.changeDir === 'up' && <ArrowUpRight className="w-3.5 h-3.5" />}
                {stats.changeDir === 'down' && <ArrowDownRight className="w-3.5 h-3.5" />}
                {stats.changeDir === 'same' && <Minus className="w-3.5 h-3.5" />}
                <span>{stats.changeDir === 'up' ? '+' : ''}{stats.changePercent}% מהחודש שעבר</span>
              </div>
            )}
            {stats.changePercent === null && (
              <p className="text-xs text-gray-400 mt-1.5">אין נתוני חודש קודם</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">החודש הקודם</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              ₪{stats.prevMonthTotal.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              {stats.prevMonthTotal > 0
                ? `${incomes.filter(i => {
                    const d = new Date(i.date);
                    const prev = new Date();
                    prev.setMonth(prev.getMonth() - 1);
                    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
                  }).length} הכנסות`
                : 'אין נתונים'}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">ממוצע חודשי</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              ₪{Math.round(stats.avgMonthly).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1.5">על פני כל הזמן</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">הכנסה הגבוהה ביותר</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              ₪{stats.maxIncome.amount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1.5 truncate">{stats.maxIncome.source}</p>
          </div>
        </div>
      )}

      {/* מנהל קטגוריות */}
      {showCategoryManager && (
        <div ref={categoryRef} className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 border-2 border-purple-200 dark:border-purple-800 overflow-hidden transition-colors">
          <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-purple-50 dark:bg-purple-900/20">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ניהול קטגוריות
            </h2>
            <button onClick={() => setShowCategoryManager(false)} className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="p-4 md:p-5">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5" />
              גרור קטגוריות לשינוי הסדר
            </p>
            <div className="space-y-2 mb-5">
              {categories.map((cat, index) => (
                <div
                  key={cat.name + index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    dragOver === index ? 'border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/30 scale-[1.01]'
                    : dragIndex === index ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 opacity-50'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  {editingCat?.index === index ? (
                    <div className="flex flex-1 items-center gap-2 flex-wrap">
                      <input type="color" value={editingCat.color}
                        onChange={(e) => setEditingCat({...editingCat, color: e.target.value})}
                        className="w-9 h-9 rounded cursor-pointer border border-gray-300 dark:border-gray-600 flex-shrink-0 bg-transparent" />
                      <input type="text" value={editingCat.name}
                        onChange={(e) => setEditingCat({...editingCat, name: e.target.value})}
                        className="flex-1 min-w-[100px] px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                      <button onClick={handleUpdateCategory}
                        className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-600 font-medium">✓ שמור</button>
                      <button onClick={() => setEditingCat(null)}
                        className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500">ביטול</button>
                    </div>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-white dark:border-gray-800 shadow-sm"
                        style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingCat({ index, name: cat.name, color: cat.color })}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteCategory(index)}
                          className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
                הוסף קטגוריה חדשה
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="color" value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600 bg-transparent flex-shrink-0" />
                <input type="text" value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="שם הקטגוריה החדשה"
                  className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-purple-500" />
                <button onClick={handleAddCategory} disabled={!newCatName.trim()}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  הוסף
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* פס חיפוש + סינון מתקדם */}
      <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 overflow-hidden border border-gray-200 dark:border-gray-700 transition-colors">
        <div className="p-3 md:p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={filters.search}
              onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
              placeholder="חיפוש לפי מקור הכנסה..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-colors" />
          </div>
          <select value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({...prev, sortBy: e.target.value}))}
            className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm min-w-[140px] transition-colors">
            <option value="date-desc">תאריך (חדש לישן)</option>
            <option value="date-asc">תאריך (ישן לחדש)</option>
            <option value="amount-desc">סכום (גבוה לנמוך)</option>
            <option value="amount-asc">סכום (נמוך לגבוה)</option>
          </select>
          <button onClick={() => setShowAdvancedFilters(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors text-sm font-medium whitespace-nowrap ${
              showAdvancedFilters || activeFiltersCount > 0
                ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
            <SlidersHorizontal className="w-4 h-4" />
            סינון מתקדם
            {activeFiltersCount > 0 && (
              <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {showAdvancedFilters && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 md:p-4 bg-gray-50 dark:bg-gray-800/50 transition-colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">קטגוריה</label>
                <select value={filters.category}
                  onChange={(e) => setFilters(prev => ({...prev, category: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm">
                  <option value="">כל הקטגוריות</option>
                  {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">מתאריך</label>
                <input type="date" value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({...prev, dateFrom: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">עד תאריך</label>
                <input type="date" value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({...prev, dateTo: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">סכום מינימום (₪)</label>
                <input type="number" value={filters.amountFrom} placeholder="0" min="0"
                  onChange={(e) => setFilters(prev => ({...prev, amountFrom: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">סכום מקסימום (₪)</label>
                <input type="number" value={filters.amountTo} placeholder="ללא הגבלה" min="0"
                  onChange={(e) => setFilters(prev => ({...prev, amountTo: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={handleClearFilters}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm font-medium">
                  <X className="w-4 h-4" />נקה סינונים
                </button>
              </div>
            </div>
            {(activeFiltersCount > 0 || filters.search) && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-green-700 dark:text-green-500">{filteredIncomes.length}</span>
                <span>תוצאות מתוך</span>
                <span className="font-medium text-gray-900 dark:text-gray-300">{incomes.length}</span>
                <span>הכנסות</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* טופס הוספה/עריכה */}
      {showForm && (
        <div ref={formRef} className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm mb-6 border-2 border-green-200 dark:border-green-800 transition-colors">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-4">
            {editingId ? 'עריכת הכנסה' : 'הוספת הכנסה חדשה'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">מקור ההכנסה *</label>
              <input type="text" value={formData.source}
                onChange={(e) => setFormData(prev => ({...prev, source: e.target.value}))}
                placeholder="למשל: משכורת חודש ינואר"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm md:text-base" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">סכום (₪) *</label>
              <input type="number" value={formData.amount}
                onChange={(e) => setFormData(prev => ({...prev, amount: e.target.value}))}
                placeholder="5000" min="0" step="0.01"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm md:text-base" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">קטגוריה</label>
              <div className="flex gap-2">
                <div className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 flex-shrink-0 transition-colors duration-200"
                  style={{ backgroundColor: getCategoryColor(formData.category) }} />
                <select value={formData.category}
                  onChange={(e) => setFormData(prev => ({...prev, category: e.target.value}))}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm md:text-base">
                  {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">תאריך</label>
              <input type="date" value={formData.date}
                onChange={(e) => setFormData(prev => ({...prev, date: e.target.value}))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 text-sm md:text-base" />
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 mt-2">
              <button type="submit"
                className="flex-1 bg-green-600 text-white py-2.5 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm md:text-base">
                {editingId ? 'עדכן הכנסה' : 'שמור הכנסה'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm md:text-base">
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* רשימת הכנסות */}
      {filteredIncomes.length > 0 && (
        <>
          {/* כרטיסים - מובייל */}
          <div className="gsap-card block md:hidden space-y-3 mb-6">
            {filteredIncomes.map((income) => {
              const catColor = getCategoryColor(income.category);
              return (
                <div key={income.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors"
                  style={{ borderRightColor: catColor, borderRightWidth: '4px' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{income.source}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{ backgroundColor: catColor + '20', color: catColor }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                          {income.category}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(income.date).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">₪{income.amount.toLocaleString()}</p>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <button onClick={() => handleEdit(income)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(income.id)}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* טבלה - דסקטופ */}
          <div className="gsap-card hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-green-50 dark:bg-green-900/20 border-b border-gray-200 dark:border-gray-700 transition-colors">
                  <tr>
                    <th className="text-right py-4 px-6 font-bold text-gray-700 dark:text-gray-300">מקור</th>
                    <th className="text-right py-4 px-6 font-bold text-gray-700 dark:text-gray-300">קטגוריה</th>
                    <th className="text-right py-4 px-6 font-bold text-gray-700 dark:text-gray-300">סכום</th>
                    <th className="text-right py-4 px-6 font-bold text-gray-700 dark:text-gray-300">תאריך</th>
                    <th className="text-center py-4 px-6 font-bold text-gray-700 dark:text-gray-300">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredIncomes.map((income) => {
                    const catColor = getCategoryColor(income.category);
                    return (
                      <tr key={income.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="py-4 px-6 text-gray-900 dark:text-white font-medium">{income.source}</td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full"
                            style={{ backgroundColor: catColor + '20', color: catColor }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                            {income.category}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-bold text-lg text-green-600 dark:text-green-400">
                          ₪{income.amount.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-gray-600 dark:text-gray-400">
                          {new Date(income.date).toLocaleDateString('he-IL')}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleEdit(income)}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="ערוך">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(income.id)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="מחק">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {filteredIncomes.length === 0 && (
        <div className="gsap-card text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl mt-6 border border-gray-200 dark:border-gray-700 transition-colors">
          <TrendingUp className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {incomes.length === 0 ? 'אין הכנסות עדיין' : 'לא נמצאו תוצאות'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {incomes.length === 0 ? 'התחל להוסיף הכנסות לעקוב אחרי הכסף שלך!' : 'נסה לשנות את הסינונים'}
          </p>
          {incomes.length === 0 && (
            <button onClick={handleNewIncome}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl hover:bg-green-700 transition-colors font-medium">
              <Plus className="w-4 h-4" />
              הוסף הכנסה ראשונה
            </button>
          )}
        </div>
      )}
    </div>
  );
}