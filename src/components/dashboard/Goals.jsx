import { Target, TrendingUp, Award, Plus, Trash2, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAppContext } from '../../context/AppContext';

// ✅ ייבוא GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function Goals() {
  const { showToast } = useToast();
  const { state: { goals = [] }, dispatch } = useAppContext(); 
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    target: '',
    current: '',
    deadline: '',
    category: 'חיסכון'
  });

  const inputRefs = useRef({});
  const containerRef = useRef(null); // ✅ רפרנס GSAP

  // ✅ הפעלת אנימציית הכניסה
  useGSAP(() => {
    gsap.from('.gsap-card', {
      y: 30,             
      opacity: 0,        
      duration: 0.5,     
      stagger: 0.1,      
      ease: 'power2.out',
      clearProps: 'all'  
    });
  }, { scope: containerRef });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.target || !formData.deadline) {
      showToast('נא למלא את כל השדות החובה', 'error');
      return;
    }
    const newGoal = {
      id: Date.now(),
      title: formData.title,
      target: Number(formData.target),
      current: Number(formData.current) || 0,
      deadline: formData.deadline,
      category: formData.category
    };

    dispatch({ type: 'ADD_GOAL', payload: newGoal });
    
    setFormData({ title: '', target: '', current: '', deadline: '', category: 'חיסכון' });
    setShowForm(false);
    showToast('היעד נוסף בהצלחה! 🎯', 'success');
  };

  const handleDelete = (id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק יעד זה?')) {
      dispatch({ type: 'DELETE_GOAL', payload: id });
      delete inputRefs.current[id];
      showToast('היעד נמחק בהצלחה', 'success');
    }
  };

  const handleAddMoney = (id) => {
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

    const updatedGoal = { ...currentGoal, current: currentGoal.current + amount };
    dispatch({ type: 'UPDATE_GOAL', payload: updatedGoal });

    if (inputEl) inputEl.value = '';
    showToast(`נוספו ₪${amount.toLocaleString()} ליעד! ✅`, 'success');
  };

  const handleSubtractMoney = (id) => {
    const inputEl = inputRefs.current[id];
    const amount = Number(inputEl?.value);

    if (!amount || amount <= 0) {
      showToast('נא להכניס סכום גדול מ-0', 'error');
      return;
    }

    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;

    const newCurrent = currentGoal.current - amount;
    const updatedGoal = { ...currentGoal, current: Math.max(newCurrent, 0) };
    
    dispatch({ type: 'UPDATE_GOAL', payload: updatedGoal });

    if (inputEl) inputEl.value = '';
    showToast(`הופחתו ₪${amount.toLocaleString()} מהיעד!`, 'warning');
  };

  const handleComplete = (id) => {
    const currentGoal = goals.find(g => g.id === id);
    if (!currentGoal) return;

    if (confirm(`סמן את "${currentGoal.title}" כהושלם?`)) {
      const updatedGoal = { ...currentGoal, current: currentGoal.target };
      dispatch({ type: 'UPDATE_GOAL', payload: updatedGoal });
      showToast('ברכות! היעד הושלם! 🎉', 'success');
    }
  };

  return (
    <div className="p-8 relative transition-colors" ref={containerRef}>

      {/* כותרת */}
      <div className="gsap-card flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">יעדים 🎯</h1>
          <p className="text-gray-600 dark:text-gray-400 transition-colors">הגדר ועקוב אחרי היעדים הפיננסיים שלך</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#e5007e] text-white px-6 py-3 rounded-xl hover:bg-[#b30062] transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          יעד חדש
        </button>
      </div>

      {/* כרטיסי סיכום */}
      <div className="gsap-card grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-purple-400 via-pink-400 to-[#e5007e] dark:from-purple-600 dark:via-pink-600 dark:to-[#b30062] rounded-2xl p-6 text-white shadow-lg transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-8 h-8" />
            <h3 className="text-lg font-medium">סך יעדים</h3>
          </div>
          <p className="text-4xl font-bold">{goals.length}</p>
          <p className="text-sm mt-2 text-white/80">יעדים פעילים</p>
        </div>

        <div className="bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 dark:from-green-600 dark:via-emerald-600 dark:to-teal-700 rounded-2xl p-6 text-white shadow-lg transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-8 h-8" />
            <h3 className="text-lg font-medium">הושלמו</h3>
          </div>
          <p className="text-4xl font-bold">
            {goals.filter(g => g.current >= g.target).length}
          </p>
          <p className="text-sm mt-2 text-white/80">יעדים שהושגו</p>
        </div>

        <div className="bg-gradient-to-br from-blue-400 via-cyan-400 to-sky-500 dark:from-blue-600 dark:via-cyan-600 dark:to-sky-700 rounded-2xl p-6 text-white shadow-lg transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8" />
            <h3 className="text-lg font-medium">ממוצע התקדמות</h3>
          </div>
          <p className="text-4xl font-bold">
            {goals.length > 0 
              ? Math.round(goals.reduce((sum, g) => sum + (g.current / g.target * 100), 0) / goals.length)
              : 0}%
          </p>
          <p className="text-sm mt-2 text-white/80">מכלל היעדים</p>
        </div>
      </div>

      {/* טופס הוספת יעד */}
      {showForm && (
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-8 border-2 border-[#e5007e] transition-colors">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">הוספת יעד חדש</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">שם היעד *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="למשל: חיסכון לרכישת מכשיר לייזר"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">סכום יעד (₪) *</label>
              <input
                type="number"
                value={formData.target}
                onChange={(e) => setFormData({...formData, target: e.target.value})}
                placeholder="5000"
                min="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">סכום נוכחי (₪)</label>
              <input
                type="number"
                value={formData.current}
                onChange={(e) => setFormData({...formData, current: e.target.value})}
                placeholder="0"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">תאריך יעד *</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">קטגוריה</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#e5007e]"
              >
                <option>חיסכון</option>
                <option>הכנסות</option>
                <option>השקעה</option>
                <option>צמצום הוצאות</option>
                <option>אחר</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-[#e5007e] text-white py-2 px-4 rounded-lg hover:bg-[#b30062] transition-colors font-medium"
              >
                שמור יעד
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* כרטיסי יעדים */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {goals.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          const isCompleted = progress >= 100;
          const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
          
          return (
            <div key={goal.id} className={`gsap-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-2 transition-colors ${
              isCompleted ? 'border-green-400 dark:border-green-500' : 'border-gray-200 dark:border-gray-700'
            }`}>
              {/* כותרת */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {isCompleted && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{goal.title}</h3>
                  </div>
                  <span className="inline-block px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full">
                    {goal.category}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors"
                  title="מחק יעד"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* סכומים */}
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">התקדמות</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ₪{goal.current.toLocaleString()}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-gray-600 dark:text-gray-400">יעד</p>
                  <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
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
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {daysLeft > 0 ? `${daysLeft} ימים נותרו` : 'פג תוקף'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      isCompleted 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700' 
                        : 'bg-gradient-to-r from-[#e5007e] to-[#ff4da6] dark:from-[#b30062] dark:to-[#e5007e]'
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
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
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-[#e5007e]"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.target.value) {
                          handleAddMoney(goal.id);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddMoney(goal.id)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      title="הוסף כסף"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSubtractMoney(goal.id)}
                      className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
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
                <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-600 p-3 rounded mt-4">
                  <p className="text-green-800 dark:text-green-400 font-medium text-sm">🎉 כל הכבוד! השגת את היעד!</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="gsap-card text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl transition-colors">
          <Target className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">אין יעדים עדיין</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">התחל להגדיר יעדים פיננסיים ועקוב אחרי ההתקדמות!</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#e5007e] text-white px-6 py-3 rounded-lg hover:bg-[#b30062] transition-colors font-medium"
          >
            הוסף יעד ראשון
          </button>
        </div>
      )}
    </div>
  );
}