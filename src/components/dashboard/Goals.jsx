import { Target, TrendingUp, Award, Plus, Trash2, CheckCircle, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';

// ✅ Firebase Auth + Firestore
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';

// ✅ GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const CATEGORIES = ['הכל', 'חיסכון', 'הכנסות', 'השקעה', 'צמצום הוצאות', 'אחר'];

const CATEGORY_COLORS = {
  'חיסכון':          'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  'הכנסות':         'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  'השקעה':          'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  'צמצום הוצאות':   'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  'אחר':            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

export default function Goals() {
  const { showToast } = useToast();

  // ✅ Firebase state
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  const containerRef = useRef(null);
  const inputRefs = useRef({});

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    target: '',
    current: '',
    deadline: '',
    category: 'חיסכון'
  });

  // ✅ שדרוג: סינון לפי קטגוריה
  const [activeCategory, setActiveCategory] = useState('הכל');

  // ✅ טעינת יעדים מ-Firestore בזמן אמת
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoadingGoals(false);
      return;
    }

    const q = query(
      collection(db, 'goals'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGoals(data);
      setLoadingGoals(false);
    });

    return () => unsubscribe();
  }, []);

  // ✅ תיקון GSAP: if (loading) return בתוך useGSAP + dependencies
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

  // ✅ יעדים מסוננים לפי קטגוריה
  const filteredGoals = activeCategory === 'הכל'
    ? goals
    : goals.filter(g => g.category === activeCategory);

  // ✅ סטטיסטיקות כלליות (על כל היעדים, לא רק המסוננים)
  const completedCount = goals.filter(g => g.current >= g.target).length;
  const avgProgress = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + (g.current / g.target * 100), 0) / goals.length)
    : 0;

  // ✅ שמירת יעד חדש ל-Firestore
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.target || !formData.deadline) {
      showToast('נא למלא את כל השדות החובה', 'error');
      return;
    }
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
      setFormData({ title: '', target: '', current: '', deadline: '', category: 'חיסכון' });
      setShowForm(false);
      showToast('היעד נוסף בהצלחה! 🎯', 'success');
    } catch (error) {
      console.error(error);
      showToast('שגיאה בהוספת היעד', 'error');
    }
  }, [formData, showToast]);

  // ✅ מחיקת יעד מ-Firestore
  const handleDelete = useCallback(async (id) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק יעד זה?')) return;
    try {
      await deleteDoc(doc(db, 'goals', id));
      delete inputRefs.current[id];
      showToast('היעד נמחק בהצלחה', 'success');
    } catch (error) {
      console.error(error);
      showToast('שגיאה במחיקת היעד', 'error');
    }
  }, [showToast]);

  // ✅ עדכון סכום ב-Firestore
  const handleAddMoney = useCallback(async (id) => {
    const inputEl = inputRefs.current[id];
    const amount = Number(inputEl?.value);
    if (!amount || amount <= 0) {
      showToast('נא להכניס סכום גדול מ-0', 'error');
      return;
    }
    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;
    const remaining = currentGoal.target - currentGoal.current;
    if (amount > remaining) {
      showToast(`שגיאה: ניתן להוסיף מקסימום ₪${remaining.toLocaleString()} לסיום היעד`, 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'goals', id), {
        current: currentGoal.current + amount,
        updatedAt: new Date()
      });
      if (inputEl) inputEl.value = '';
      showToast(`נוספו ₪${amount.toLocaleString()} ליעד! ✅`, 'success');
    } catch (error) {
      console.error(error);
      showToast('שגיאה בעדכון היעד', 'error');
    }
  }, [goals, showToast]);

  // ✅ הפחתת סכום ב-Firestore
  const handleSubtractMoney = useCallback(async (id) => {
    const inputEl = inputRefs.current[id];
    const amount = Number(inputEl?.value);
    if (!amount || amount <= 0) {
      showToast('נא להכניס סכום גדול מ-0', 'error');
      return;
    }
    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;
    try {
      await updateDoc(doc(db, 'goals', id), {
        current: Math.max(currentGoal.current - amount, 0),
        updatedAt: new Date()
      });
      if (inputEl) inputEl.value = '';
      showToast(`הופחתו ₪${amount.toLocaleString()} מהיעד!`, 'warning');
    } catch (error) {
      console.error(error);
      showToast('שגיאה בעדכון היעד', 'error');
    }
  }, [goals, showToast]);

  // ✅ סימון כהושלם ב-Firestore
  const handleComplete = useCallback(async (id) => {
    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;
    if (!confirm(`סמן את "${currentGoal.title}" כהושלם?`)) return;
    try {
      await updateDoc(doc(db, 'goals', id), {
        current: currentGoal.target,
        updatedAt: new Date()
      });
      showToast('ברכות! היעד הושלם! 🎉', 'success');
    } catch (error) {
      console.error(error);
      showToast('שגיאה בעדכון היעד', 'error');
    }
  }, [goals, showToast]);

  return (
    // ✅ ref תמיד קיים על ה-div הראשי
    <div className="pt-2 pb-8 px-4 md:p-8 relative transition-colors" ref={containerRef}>

      {/* ✅ Spinner בתוך ה-div הראשי */}
      {loadingGoals ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">טוען יעדים...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ✅ כותרת — תוקנה למובייל: flex-col בסלולר */}
          <div className="gsap-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">יעדים 🎯</h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 transition-colors">הגדר ועקוב אחרי היעדים הפיננסיים שלך</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-[#e5007e] text-white px-4 sm:px-6 py-2.5 rounded-xl hover:bg-[#b30062] transition-colors font-medium text-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-5 h-5" />
              יעד חדש
            </button>
          </div>

          {/* כרטיסי סיכום */}
          <div className="gsap-card grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="bg-gradient-to-br from-purple-400 via-pink-400 to-[#e5007e] dark:from-purple-600 dark:via-pink-600 dark:to-[#b30062] rounded-2xl p-5 md:p-6 text-white shadow-lg transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-7 h-7 md:w-8 md:h-8" />
                <h3 className="text-base md:text-lg font-medium">סך יעדים</h3>
              </div>
              <p className="text-3xl md:text-4xl font-bold">{goals.length}</p>
              <p className="text-sm mt-2 text-white/80">יעדים פעילים</p>
            </div>

            <div className="bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 dark:from-green-600 dark:via-emerald-600 dark:to-teal-700 rounded-2xl p-5 md:p-6 text-white shadow-lg transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-7 h-7 md:w-8 md:h-8" />
                <h3 className="text-base md:text-lg font-medium">הושלמו</h3>
              </div>
              <p className="text-3xl md:text-4xl font-bold">{completedCount}</p>
              <p className="text-sm mt-2 text-white/80">יעדים שהושגו</p>
            </div>

            <div className="bg-gradient-to-br from-blue-400 via-cyan-400 to-sky-500 dark:from-blue-600 dark:via-cyan-600 dark:to-sky-700 rounded-2xl p-5 md:p-6 text-white shadow-lg transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-7 h-7 md:w-8 md:h-8" />
                <h3 className="text-base md:text-lg font-medium">ממוצע התקדמות</h3>
              </div>
              <p className="text-3xl md:text-4xl font-bold">{avgProgress}%</p>
              <p className="text-sm mt-2 text-white/80">מכלל היעדים</p>
            </div>
          </div>

          {/* טופס הוספת יעד */}
          {showForm && (
            <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm mb-6 md:mb-8 border-2 border-[#e5007e] transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">הוספת יעד חדש</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">שם היעד *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="למשל: חיסכון לרכישת מכשיר לייזר"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">סכום יעד (₪) *</label>
                  <input
                    type="number"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    placeholder="5000"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">סכום נוכחי (₪)</label>
                  <input
                    type="number"
                    value={formData.current}
                    onChange={(e) => setFormData({ ...formData, current: e.target.value })}
                    placeholder="0"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">תאריך יעד *</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">קטגוריה</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e] text-sm"
                  >
                    {CATEGORIES.filter(c => c !== 'הכל').map(cat => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-[#e5007e] text-white py-2 px-4 rounded-lg hover:bg-[#b30062] transition-colors font-medium text-sm"
                  >
                    שמור יעד
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ✅ שדרוג: סינון לפי קטגוריה */}
          {goals.length > 0 && (
            <div className="gsap-card flex items-center gap-2 mb-5 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {CATEGORIES.map(cat => {
                const count = cat === 'הכל'
                  ? goals.length
                  : goals.filter(g => g.category === cat).length;
                if (count === 0 && cat !== 'הכל') return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      activeCategory === cat
                        ? 'bg-[#e5007e] text-white border-[#e5007e]'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cat}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeCategory === cat ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {count}
                    </span>
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

                return (
                  <div key={goal.id} className={`gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-lg border-2 transition-colors ${
                    isCompleted ? 'border-green-400 dark:border-green-500' : 'border-gray-200 dark:border-gray-700'
                  }`}>
                    {/* כותרת כרטיס */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 ml-2">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {isCompleted && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />}
                          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-tight">{goal.title}</h3>
                        </div>
                        <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${CATEGORY_COLORS[goal.category] || CATEGORY_COLORS['אחר']}`}>
                          {goal.category}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors flex-shrink-0"
                        title="מחק יעד"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* סכומים */}
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">התקדמות</p>
                        <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                          ₪{goal.current.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">יעד</p>
                        <p className="text-lg md:text-xl font-bold text-gray-700 dark:text-gray-300">
                          ₪{goal.target.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {progress.toFixed(0)}% הושלם
                        </span>
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
                          className={`h-3 rounded-full transition-all duration-500 ${
                            isCompleted
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700'
                              : 'bg-gradient-to-r from-[#e5007e] to-[#ff4da6] dark:from-[#b30062] dark:to-[#e5007e]'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* עדכון התקדמות */}
                    {!isCompleted && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            ref={el => inputRefs.current[goal.id] = el}
                            type="number"
                            placeholder="הכנס סכום"
                            min="0"
                            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-[#e5007e]"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target.value) {
                                handleAddMoney(goal.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddMoney(goal.id)}
                            className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                            title="הוסף כסף"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSubtractMoney(goal.id)}
                            className="flex-shrink-0 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                            title="הפחת כסף"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => handleComplete(goal.id)}
                          className="w-full px-4 py-2 bg-[#e5007e] text-white rounded-lg hover:bg-[#b30062] transition-colors text-sm font-medium"
                        >
                          ✓ סמן כהושלם
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          💡 הכנס סכום ולחץ ↑ להוסיף | ↓ להפחית | Enter להוסיף
                        </p>
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
            // אין יעדים בקטגוריה הנבחרת
            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <Filter className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">אין יעדים בקטגוריה "{activeCategory}"</p>
              <button
                onClick={() => setActiveCategory('הכל')}
                className="mt-3 text-[#e5007e] text-sm font-medium hover:underline"
              >
                הצג את כל היעדים
              </button>
            </div>
          ) : (
            // אין יעדים בכלל
            <div className="gsap-card text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl transition-colors">
              <Target className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">אין יעדים עדיין</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">התחל להגדיר יעדים פיננסיים ועקוב אחרי ההתקדמות!</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-[#e5007e] text-white px-6 py-2.5 rounded-lg hover:bg-[#b30062] transition-colors font-medium text-sm"
              >
                הוסף יעד ראשון
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
