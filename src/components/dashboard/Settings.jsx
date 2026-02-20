import { Settings as SettingsIcon, Trash2, Download, Upload, AlertTriangle } from 'lucide-react';
import { useState, useRef } from 'react'; // ✅ הוספנו useRef
import { useToast } from '../../context/ToastContext';
import { useAppContext } from '../../context/AppContext';

// ✅ ייבוא GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export default function Settings() {
  const { showToast } = useToast();
  const { state, dispatch } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  
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

  const handleClearAll = () => {
    localStorage.clear();
    showToast('כל הנתונים נמחקו בהצלחה! 🗑️', 'success');
    setShowConfirm(false);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleExportAll = () => {
    const data = {
      incomes: state.incomes || [],
      expenses: state.expenses || [],
      budget: state.budget || { income: 10000, expenses: 8000 },
      categoryBudgets: state.categoryBudgets || {},
      goals: state.goals || [],
      
      incomeCategories: JSON.parse(localStorage.getItem('incomeCategories') || 'null'),
      expenseCategoriesFull: JSON.parse(localStorage.getItem('expenseCategoriesFull') || 'null'),
      
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `BeautyFlow_backup_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.json`;
    link.click();
    showToast('הנתונים יוצאו בהצלחה! 📥', 'success');
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.incomes) dispatch({ type: 'SET_INCOMES', payload: data.incomes });
        if (data.expenses) dispatch({ type: 'SET_EXPENSES', payload: data.expenses });
        if (data.budget) dispatch({ type: 'SET_BUDGET', payload: data.budget });
        if (data.categoryBudgets) dispatch({ type: 'SET_CATEGORY_BUDGETS', payload: data.categoryBudgets });
        if (data.goals) dispatch({ type: 'SET_GOALS', payload: data.goals });
        
        if (data.incomeCategories) localStorage.setItem('incomeCategories', JSON.stringify(data.incomeCategories));
        if (data.expenseCategoriesFull) localStorage.setItem('expenseCategoriesFull', JSON.stringify(data.expenseCategoriesFull));
        
        showToast('הנתונים יובאו בהצלחה! ✅', 'success');
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        showToast('שגיאה: הקובץ לא תקין! ❌', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 transition-colors" ref={containerRef}>
      {/* כותרת */}
      <div className="gsap-card mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">הגדרות ⚙️</h1>
        <p className="text-gray-600 dark:text-gray-400 transition-colors">ניהול נתונים והגדרות מערכת</p>
      </div>

      {/* כרטיסי פעולות */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ייצוא נתונים */}
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-2 border-green-200 dark:border-green-900/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-xl">
              <Download className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">ייצוא נתונים</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">גיבוי של כל המידע שלך</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            שמור את כל הנתונים שלך (הכנסות, הוצאות, תקציב, יעדים) לקובץ JSON.
          </p>
          <button
            onClick={handleExportAll}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            📥 ייצא את כל הנתונים
          </button>
        </div>

        {/* ייבוא נתונים */}
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-2 border-blue-200 dark:border-blue-900/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
              <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">ייבוא נתונים</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">שחזר גיבוי קודם</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            טען קובץ גיבוי קודם ושחזר את כל הנתונים.
          </p>
          <label className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center cursor-pointer">
            📤 בחר קובץ לייבוא
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>

        {/* נקה נתונים */}
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border-2 border-red-200 dark:border-red-900/50 md:col-span-2 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl">
              <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">נקה את כל הנתונים</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">מחיקה מלאה של המערכת</p>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-600 p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5" />
              <div>
                <p className="text-red-800 dark:text-red-400 font-medium">אזהרה!</p>
                <p className="text-red-700 dark:text-red-300 text-sm">פעולה זו תמחק את כל ההכנסות, ההוצאות, התקציב, היעדים והקטגוריות. לא ניתן לשחזר!</p>
              </div>
            </div>
          </div>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              🗑️ מחק את כל הנתונים
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleClearAll}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                ✅ אישור - מחק הכל
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 px-4 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                ❌ ביטול
              </button>
            </div>
          )}
        </div>
      </div>

      {/* מידע נוסף */}
      <div className="gsap-card mt-8 bg-gradient-to-r from-[#e5007e] to-[#ff4da6] dark:from-[#b30062] dark:to-[#e5007e] rounded-xl p-6 text-white shadow-md transition-colors">
        <h3 className="text-xl font-bold mb-2">💡 טיפים</h3>
        <ul className="space-y-2 text-sm">
          <li>• ייצא את הנתונים באופן קבוע לגיבוי</li>
          <li>• שמור את קובץ הגיבוי במקום בטוח (Google Drive, Dropbox)</li>
          <li>• לפני מחיקת נתונים - ודא שיש לך גיבוי!</li>
          <li>• קובץ הגיבוי כולל את כל המידע והקטגוריות המותאמות אישית</li>
        </ul>
      </div>
    </div>
  );
}