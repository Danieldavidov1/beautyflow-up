import { Target, TrendingUp, Award, Plus, Trash2, CheckCircle, ArrowUp, ArrowDown, Filter, X, Tag, GripVertical, Edit2, BarChart3, PieChart as PieChartIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';

// ✅ Firebase Auth + Firestore
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';

// ✅ GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// ✅ Recharts — רק לגרף עוגה
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const HEADER_HEIGHT = 73;

const DEFAULT_CATEGORIES = [
  { name: 'חיסכון',         color: '#8b5cf6' },
  { name: 'הכנסות',        color: '#10b981' },
  { name: 'השקעה',          color: '#3b82f6' },
  { name: 'צמצום הוצאות',  color: '#f97316' },
  { name: 'אחר',            color: '#6b7280' },
];

// ✅ גרף progress bars מותאם RTL
const GoalsProgressChart = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!data || !data.length) return null;

  // חיתוך הנתונים ל-3 בלבד אם לא מורחב
  const displayedData = isExpanded ? data : data.slice(0, 3);
  const hasMore = data.length > 3;

  return (
    <div className="mt-4">
      <div className="space-y-5">
        {displayedData.map((item, idx) => {
          const current = item.current || 0;
          const target = item.target || 1; 
          const pct = Math.min((current / target) * 100, 100);
          const remaining = Math.max(target - current, 0);

          return (
            <div key={idx} className="w-full">
              {/* שם היעד וסכומים */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1 sm:gap-2" dir="rtl">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate flex-1">
                  {item.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 font-medium bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full inline-block w-max">
                  ₪{current.toLocaleString()} / ₪{target.toLocaleString()}
                </span>
              </div>

              {/* פס ה-progress */}
              <div className="w-full h-6 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex shadow-inner" dir="ltr">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out flex items-center justify-end pr-2"
                  style={{ width: `${pct}%`, minWidth: pct > 8 ? undefined : '0' }}
                >
                  {pct >= 8 && (
                    <span className="text-[10px] sm:text-xs font-bold text-white whitespace-nowrap drop-shadow-sm">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="h-full flex-1" />
              </div>

              {/* תיוג תחתון */}
              <div className="flex justify-between mt-1.5 text-[11px] font-medium" dir="rtl">
                <span className="text-emerald-600 dark:text-emerald-400">הושג</span>
                <span className="text-gray-500 dark:text-gray-400">נותר: ₪{remaining.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* כפתור הרחבה/צמצום */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-5 py-2 flex items-center justify-center gap-1.5 text-sm font-medium text-[#e5007e] bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/20 dark:hover:bg-pink-900/40 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <>צמצם תצוגה <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>הצג את כל ה-{data.length} <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
};

export default function Goals() {
  const { showToast } = useToast();

  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  const containerRef = useRef(null);
  const inputRefs = useRef({});
  const formRef = useRef(null);
  const categoryRef = useRef(null);

  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    target: '',
    current: '',
    deadline: '',
    category: 'חיסכון'
  });

  const [activeCategory, setActiveCategory] = useState('הכל');

  // ✅ ניהול קטגוריות
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('goalCategories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [editingCat, setEditingCat] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#e5007e');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    localStorage.setItem('goalCategories', JSON.stringify(categories));
  }, [categories]);

  const categoryColorMap = useMemo(() => Object.fromEntries(categories.map(c => [c.name, c.color])), [categories]);
  const getCategoryColor = useCallback((catName) => categoryColorMap[catName] ?? '#6b7280', [categoryColorMap]);

  // ✅ גלילה חכמה מתוקנת (מונע צורך בלחיצה כפולה)
  const handleNewGoalClick = () => {
    setShowForm(true);
    // נותנים ל-React 100 אלפיות שנייה לרנדר את הטופס, ואז גוללים אליו
    setTimeout(() => {
      if (formRef.current) {
        const y = formRef.current.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 20;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleCategoryManagerClick = () => {
    setShowCategoryManager(!showCategoryManager);
    if (!showCategoryManager) {
      setTimeout(() => {
        if (categoryRef.current) {
          const y = categoryRef.current.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 20;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);
    }
  };

  // ✅ טעינת יעדים מ-Firestore בזמן אמת
  useEffect(() => {
    let unsubscribeSnapshot = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, 'goals'), where('userId', '==', user.uid));
        unsubscribeSnapshot = onSnapshot(q, 
          (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGoals(data);
            setLoadingGoals(false);
          },
          (error) => {
            console.error("Firebase Error:", error);
            if (error.code === 'permission-denied') {
              showToast('שגיאת הרשאות: אנא עדכן את חוקי ה-Firestore ב-Firebase', 'error');
            }
            setLoadingGoals(false);
          }
        );
      } else {
        setGoals([]);
        setLoadingGoals(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, [showToast]);

  // ✅ GSAP
  useGSAP(() => {
    if (loadingGoals) return;
    gsap.from('.gsap-card', {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      clearProps: 'all'
    });
  }, { scope: containerRef, dependencies: [loadingGoals] });

  // נתונים לגרפים וסטטיסטיקות
  const filteredGoals = activeCategory === 'הכל' ? goals : goals.filter(g => g.category === activeCategory);
  const completedCount = goals.filter(g => g.current >= g.target).length;
  const avgProgress = goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + (g.current / g.target * 100), 0) / goals.length) : 0;

  // נתוני גרף התקדמות (ללא Recharts)
  const activeGoalsChartData = useMemo(() => {
    return goals
      .filter(g => g.current < g.target)
      .map(g => ({
        name: g.title,
        current: g.current || 0,
        target: g.target || 1
      }));
  }, [goals]);

  // נתוני גרף עוגה
  const pieChartData = useMemo(() => {
    const map = {};
    goals.forEach(g => {
      map[g.category] = (map[g.category] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [goals]);


  // ✅ ניהול קטגוריות
  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    if (categories.find(c => c.name === newCatName.trim())) {
      showToast('קטגוריה כבר קיימת', 'error');
      return;
    }
    setCategories([...categories, { name: newCatName.trim(), color: newCatColor }]);
    setNewCatName('');
    showToast('קטגוריה נוספה!', 'success');
  };

  const handleUpdateCategory = () => {
    if (!editingCat) return;
    setCategories(categories.map((c, i) => i === editingCat.index ? { name: editingCat.name, color: editingCat.color } : c));
    setEditingCat(null);
    showToast('קטגוריה עודכנה!', 'success');
  };

  const handleDeleteCategory = (index) => {
    const catName = categories[index].name;
    if (goals.some(g => g.category === catName)) {
      showToast('לא ניתן למחוק קטגוריה שיש בה יעדים!', 'error');
      return;
    }
    setCategories(categories.filter((_, i) => i !== index));
    showToast('קטגוריה נמחקה', 'success');
  };

  const handleDragStart = (index) => setDragIndex(index);
  const handleDragOver = (e, index) => { e.preventDefault(); setDragOver(index); };
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const updated = [...categories];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setCategories(updated);
    setDragIndex(null);
    setDragOver(null);
  };

  // ✅ ניהול יעדים (Firebase)
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.target || !formData.deadline) {
      showToast('נא למלא את כל השדות החובה', 'error');
      return;
    }
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'goals'), {
        title: formData.title,
        target: Number(formData.target),
        current: Number(formData.current) || 0,
        deadline: formData.deadline,
        category: formData.category,
        userId: auth.currentUser.uid,
        createdAt: new Date()
      });
      setFormData({ title: '', target: '', current: '', deadline: '', category: categories[0]?.name || 'אחר' });
      setShowForm(false);
      showToast('היעד נוסף בהצלחה! 🎯', 'success');
    } catch (error) {
      showToast('שגיאה בהוספת היעד', 'error');
    }
  }, [formData, categories, showToast]);

  const handleDelete = async (id) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק יעד זה?')) return;
    await deleteDoc(doc(db, 'goals', id));
    delete inputRefs.current[id];
    showToast('היעד נמחק בהצלחה', 'success');
  };

  const handleAddMoney = async (id) => {
    const inputEl = inputRefs.current[id];
    const amount = Number(inputEl?.value);
    if (!amount || amount <= 0) return showToast('נא להכניס סכום', 'error');
    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;
    const remaining = currentGoal.target - currentGoal.current;
    if (amount > remaining) return showToast(`ניתן להוסיף מקסימום ₪${remaining.toLocaleString()}`, 'error');
    
    await updateDoc(doc(db, 'goals', id), { current: currentGoal.current + amount });
    if (inputEl) inputEl.value = '';
    showToast(`נוספו ₪${amount.toLocaleString()}! ✅`, 'success');
  };

  const handleSubtractMoney = async (id) => {
    const inputEl = inputRefs.current[id];
    const amount = Number(inputEl?.value);
    if (!amount || amount <= 0) return showToast('נא להכניס סכום', 'error');
    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;

    await updateDoc(doc(db, 'goals', id), { current: Math.max(currentGoal.current - amount, 0) });
    if (inputEl) inputEl.value = '';
    showToast(`הופחתו ₪${amount.toLocaleString()}`, 'warning');
  };

  const handleComplete = async (id) => {
    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;
    if (!confirm(`סמן את "${currentGoal.title}" כהושלם?`)) return;
    await updateDoc(doc(db, 'goals', id), { current: currentGoal.target });
    showToast('ברכות! היעד הושלם! 🎉', 'success');
  };

  return (
    <div className="pt-2 pb-8 px-4 md:p-8 relative transition-colors" ref={containerRef}>
      {loadingGoals ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">טוען יעדים...</p>
          </div>
        </div>
      ) : (
        <>
          {/* כותרת ופעולות עליונות */}
          <div className="gsap-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">יעדים 🎯</h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 transition-colors">הגדר ועקוב אחרי היעדים הפיננסיים שלך</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={handleCategoryManagerClick}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-colors w-full sm:w-auto justify-center ${
                  showCategoryManager ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 text-purple-700' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Tag className="w-4 h-4" /> קטגוריות
              </button>
              <button
                onClick={handleNewGoalClick}
                className="flex items-center gap-2 bg-[#e5007e] text-white px-4 sm:px-6 py-2.5 rounded-xl hover:bg-[#b30062] transition-colors font-medium text-sm w-full sm:w-auto justify-center"
              >
                <Plus className="w-5 h-5" /> יעד חדש
              </button>
            </div>
          </div>

          {/* כרטיסי סיכום */}
          <div className="gsap-card grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
            <div className="bg-gradient-to-br from-purple-400 via-pink-400 to-[#e5007e] rounded-2xl p-5 md:p-6 text-white shadow-lg transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-7 h-7 md:w-8 md:h-8" />
                <h3 className="text-base md:text-lg font-medium">סך יעדים</h3>
              </div>
              <p className="text-3xl md:text-4xl font-bold">{goals.length}</p>
              <p className="text-sm mt-2 text-white/80">יעדים פעילים</p>
            </div>

            <div className="bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 rounded-2xl p-5 md:p-6 text-white shadow-lg transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-7 h-7 md:w-8 md:h-8" />
                <h3 className="text-base md:text-lg font-medium">הושלמו</h3>
              </div>
              <p className="text-3xl md:text-4xl font-bold">{completedCount}</p>
              <p className="text-sm mt-2 text-white/80">יעדים שהושגו</p>
            </div>

            <div className="bg-gradient-to-br from-blue-400 via-cyan-400 to-sky-500 rounded-2xl p-5 md:p-6 text-white shadow-lg transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-7 h-7 md:w-8 md:h-8" />
                <h3 className="text-base md:text-lg font-medium">ממוצע התקדמות</h3>
              </div>
              <p className="text-3xl md:text-4xl font-bold">{avgProgress}%</p>
              <p className="text-sm mt-2 text-white/80">מכלל היעדים</p>
            </div>
          </div>

          {/* ✅ דוחות ויזואליים */}
          {goals.length > 0 && (
            <div className="gsap-card grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6">
              
              {/* גרף progress RTL */}
              {activeGoalsChartData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors h-full flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2" dir="rtl">
                    <BarChart3 className="w-5 h-5 text-blue-500 flex-shrink-0" /> התקדמות יעדים פעילים
                  </h3>
                  <div className="flex items-center gap-4 mb-2 text-xs border-b border-gray-100 dark:border-gray-700 pb-3" dir="rtl">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                      <span className="text-gray-500 dark:text-gray-400 font-medium">הושג</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600" />
                      <span className="text-gray-500 dark:text-gray-400 font-medium">נותר</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <GoalsProgressChart data={activeGoalsChartData} />
                  </div>
                </div>
              )}

              {/* גרף עוגה */}
              {pieChartData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors h-full flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2" dir="rtl">
                    <PieChartIcon className="w-5 h-5 text-purple-500 flex-shrink-0" /> התפלגות יעדים לקטגוריה
                  </h3>
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[250px]">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '10px' }} cursor={{fill: 'transparent'}} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* מנהל קטגוריות */}
          {showCategoryManager && (
            <div ref={categoryRef} className="gsap-card bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6 border-2 border-purple-200 dark:border-purple-800 overflow-hidden transition-colors">
              <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-purple-50 dark:bg-purple-900/20">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  ניהול קטגוריות ליעדים
                </h2>
                <button onClick={() => setShowCategoryManager(false)} className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 md:p-5">
                <div className="space-y-2 mb-5">
                  {categories.map((cat, index) => (
                    <div key={cat.name + index} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={(e) => handleDrop(e, index)} onDragEnd={() => {setDragIndex(null); setDragOver(null);}}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${dragOver === index ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 scale-[1.01]' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'}`}>
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab flex-shrink-0" />
                      {editingCat?.index === index ? (
                        <div className="flex flex-1 items-center gap-2 flex-wrap">
                          <input type="color" value={editingCat.color} onChange={(e) => setEditingCat({...editingCat, color: e.target.value})} className="w-9 h-9 rounded cursor-pointer border border-gray-300" />
                          <input type="text" value={editingCat.name} onChange={(e) => setEditingCat({...editingCat, name: e.target.value})} className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
                          <button onClick={handleUpdateCategory} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm">שמור</button>
                          <button onClick={() => setEditingCat(null)} className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm">ביטול</button>
                        </div>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                          <button onClick={() => setEditingCat({ index, name: cat.name, color: cat.color })} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteCategory(index)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-wrap gap-2">
                  <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-gray-300" />
                  <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} placeholder="שם הקטגוריה" className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
                  <button onClick={handleAddCategory} disabled={!newCatName.trim()} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-purple-700 transition-colors">הוסף</button>
                </div>
              </div>
            </div>
          )}

          {/* טופס הוספת יעד */}
          {showForm && (
            <div ref={formRef} className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm mb-6 border-2 border-[#e5007e] transition-colors scroll-mt-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">הוספת יעד חדש</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">שם היעד *</label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="למשל: חיסכון לרכישת מכשיר לייזר" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">סכום יעד (₪) *</label>
                  <input type="number" value={formData.target} onChange={(e) => setFormData({ ...formData, target: e.target.value })} placeholder="5000" min="1" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">סכום נוכחי (₪)</label>
                  <input type="number" value={formData.current} onChange={(e) => setFormData({ ...formData, current: e.target.value })} placeholder="0" min="0" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">תאריך יעד *</label>
                  <input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">קטגוריה</label>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-lg border border-gray-300 flex-shrink-0 transition-colors" style={{ backgroundColor: getCategoryColor(formData.category) }} />
                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm">
                      {categories.map(cat => (
                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button type="submit" className="flex-1 bg-[#e5007e] text-white py-2 px-4 rounded-lg hover:bg-[#b30062] transition-colors font-medium text-sm">שמור יעד</button>
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm">ביטול</button>
                </div>
              </form>
            </div>
          )}

          {/* סינון קטגוריות */}
          {goals.length > 0 && (
            <div className="gsap-card flex items-center gap-2 mb-5 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <button
                onClick={() => setActiveCategory('הכל')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeCategory === 'הכל' ? 'bg-[#e5007e] text-white border-[#e5007e]' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300'
                }`}
              >
                הכל <span className="bg-gray-100 text-gray-500 px-1.5 rounded-full text-[10px]">{goals.length}</span>
              </button>
              
              {categories.map(cat => {
                const count = goals.filter(g => g.category === cat.name).length;
                if (count === 0) return null;
                const isActive = activeCategory === cat.name;
                return (
                  <button key={cat.name} onClick={() => setActiveCategory(cat.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      isActive ? 'text-gray-900 dark:text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    style={{
                      backgroundColor: isActive ? cat.color + '20' : undefined,
                      borderColor: isActive ? cat.color : undefined
                    }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                    <span className="px-1.5 rounded-full text-[10px] font-bold bg-white/50">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* כרטיסי יעדים */}
          {filteredGoals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {filteredGoals.map((goal) => {
                const progress = Math.min((goal.current / goal.target) * 100, 100);
                const isCompleted = goal.current >= goal.target;
                const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                const catColor = getCategoryColor(goal.category);

                return (
                  <div key={goal.id}
                    className={`gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-lg border-2 transition-colors ${
                      isCompleted ? 'border-green-400 dark:border-green-500' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    style={{ borderRightColor: isCompleted ? '' : catColor, borderRightWidth: isCompleted ? '' : '4px' }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 ml-2">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {isCompleted && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />}
                          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight">{goal.title}</h3>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full"
                          style={{ backgroundColor: catColor + '20', color: catColor }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                          {goal.category}
                        </span>
                      </div>
                      <button onClick={() => handleDelete(goal.id)}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">התקדמות</p>
                        <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">₪{goal.current.toLocaleString()}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">יעד</p>
                        <p className="text-lg md:text-xl font-bold text-gray-700 dark:text-gray-300">₪{goal.target.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{progress.toFixed(0)}% הושלם</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          daysLeft <= 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                          daysLeft <= 7 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {daysLeft > 0 ? `${daysLeft} ימים נותרו` : 'פג תוקף'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-600' : ''}`}
                          style={{ width: `${progress}%`, backgroundColor: isCompleted ? '' : catColor }}
                        />
                      </div>
                    </div>

                    {!isCompleted && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            ref={el => inputRefs.current[goal.id] = el}
                            type="number" placeholder="הכנס סכום" min="0"
                            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-[#e5007e]"
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) handleAddMoney(goal.id); }}
                          />
                          <button onClick={() => handleAddMoney(goal.id)}
                            className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium" title="הוסף כסף">
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleSubtractMoney(goal.id)}
                            className="flex-shrink-0 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium" title="הפחת כסף">
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                        {/* ✅ כפתור סמן כהושלם תמיד בצבע ורוד מותג */}
                        <button onClick={() => handleComplete(goal.id)}
                          className="w-full px-4 py-2 bg-[#e5007e] text-white rounded-lg hover:bg-[#b30062] transition-colors text-sm font-medium">
                          ✓ סמן כהושלם
                        </button>
                      </div>
                    )}

                    {isCompleted && (
                      <div className="bg-green-50 dark:bg-green-900/20 border-r-4 border-green-500 dark:border-green-600 p-3 rounded mt-4">
                        <p className="text-green-800 dark:text-green-400 font-medium text-sm">🎉 כל הכבוד! השגת את היעד!</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : goals.length > 0 ? (
            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <Filter className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">אין יעדים בקטגוריה "{activeCategory}"</p>
              <button onClick={() => setActiveCategory('הכל')} className="mt-3 text-[#e5007e] text-sm font-medium hover:underline">
                הצג את כל היעדים
              </button>
            </div>
          ) : (
            <div className="gsap-card text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl transition-colors">
              <Target className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">אין יעדים עדיין</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">התחל להגדיר יעדים פיננסיים ועקוב אחרי ההתקדמות!</p>
              <button onClick={handleNewGoalClick}
                className="bg-[#e5007e] text-white px-6 py-2.5 rounded-lg hover:bg-[#b30062] transition-colors font-medium text-sm">
                הוסף יעד ראשון
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}