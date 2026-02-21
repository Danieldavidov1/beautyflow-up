import { Settings as SettingsIcon, Trash2, Download, Upload, AlertTriangle, LogOut } from 'lucide-react';
import { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';

// ✅ Firebase Auth + Firestore
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, query, where, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';

// ✅ GSAP
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// אוסף הקולקציות של המשתמש
const USER_COLLECTIONS = ['incomes', 'expenses', 'goals', 'budgets'];

export default function Settings() {
  const { showToast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const containerRef = useRef(null);

  // ✅ תיקון GSAP — dependencies מוגדרות
  useGSAP(() => {
    gsap.from('.gsap-card', {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      clearProps: 'all'
    });
  }, { scope: containerRef, dependencies: [] });

  // ✅ ייצוא מ-Firestore
  const handleExportAll = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) { showToast('לא מחובר', 'error'); return; }

    setIsExporting(true);
    try {
      const exportData = { exportDate: new Date().toISOString(), userId };

      for (const col of USER_COLLECTIONS) {
        const q = query(collection(db, col), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        exportData[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      // קטגוריות מ-localStorage (מותאם אישית)
      exportData.incomeCategories = JSON.parse(localStorage.getItem('incomeCategories') || 'null');
      exportData.expenseCategoriesFull = JSON.parse(localStorage.getItem('expenseCategoriesFull') || 'null');
      exportData.goalCategories = JSON.parse(localStorage.getItem('goalCategories') || 'null');

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `BeautyFlow_backup_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.json`;
      link.click();
      showToast('הנתונים יוצאו בהצלחה! 📥', 'success');
    } catch (error) {
      console.error(error);
      showToast('שגיאה בייצוא הנתונים', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ✅ ייבוא ל-Firestore
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const userId = auth.currentUser?.uid;
    if (!userId) { showToast('לא מחובר', 'error'); return; }

    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
        const data = JSON.parse(e.target.result);

        // ייבוא קולקציות ל-Firestore
        for (const col of USER_COLLECTIONS) {
          if (data[col]?.length) {
            for (const item of data[col]) {
              const { id, ...itemData } = item;
              await addDoc(collection(db, col), { ...itemData, userId });
            }
          }
        }

        // שמירת קטגוריות ב-localStorage
        if (data.incomeCategories)
          localStorage.setItem('incomeCategories', JSON.stringify(data.incomeCategories));
        if (data.expenseCategoriesFull)
          localStorage.setItem('expenseCategoriesFull', JSON.stringify(data.expenseCategoriesFull));
        if (data.goalCategories)
          localStorage.setItem('goalCategories', JSON.stringify(data.goalCategories));

        showToast('הנתונים יובאו בהצלחה! ✅', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch (error) {
        console.error(error);
        showToast('שגיאה: הקובץ לא תקין! ❌', 'error');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    // איפוס input כדי לאפשר בחירה חוזרת
    event.target.value = '';
  };

  // ✅ מחיקת כל הנתונים מ-Firestore
  const handleClearAll = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) { showToast('לא מחובר', 'error'); return; }

    setIsClearing(true);
    try {
      const batch = writeBatch(db);
      let deleteCount = 0;

      for (const col of USER_COLLECTIONS) {
        const q = query(collection(db, col), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => {
          batch.delete(doc(db, col, d.id));
          deleteCount++;
        });
      }

      await batch.commit();

      // ניקוי localStorage
      ['incomeCategories', 'expenseCategoriesFull', 'goalCategories'].forEach(k =>
        localStorage.removeItem(k));

      showToast(`נמחקו ${deleteCount} רשומות בהצלחה! 🗑️`, 'success');
      setShowConfirm(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error(error);
      showToast('שגיאה במחיקת הנתונים', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // ✅ התנתקות
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('התנתקת בהצלחה', 'success');
    } catch (error) {
      showToast('שגיאה בהתנתקות', 'error');
    }
  };

  return (
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors" ref={containerRef}>

      {/* כותרת */}
      <div className="gsap-card mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">הגדרות ⚙️</h1>
        <p className="text-gray-600 dark:text-gray-400 transition-colors text-sm md:text-base">ניהול נתונים והגדרות מערכת</p>
      </div>

      {/* מידע על המשתמש המחובר */}
      {auth.currentUser && (
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex items-center justify-between gap-3 flex-wrap transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e5007e] to-[#ff4da6] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {auth.currentUser.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {auth.currentUser.displayName || 'משתמש'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{auth.currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            התנתק
          </button>
        </div>
      )}

      {/* כרטיסי פעולות */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

        {/* ייצוא נתונים */}
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-5 md:p-6 shadow-lg border-2 border-green-200 dark:border-green-900/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-xl flex-shrink-0">
              <Download className="w-7 h-7 md:w-8 md:h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">ייצוא נתונים</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">גיבוי של כל המידע שלך</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm">
            שמור את כל הנתונים (הכנסות, הוצאות, תקציב, יעדים) לקובץ JSON.
          </p>
          <button
            onClick={handleExportAll}
            disabled={isExporting}
            className="w-full bg-green-600 text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />מייצא...</>
            ) : '📥 ייצא את כל הנתונים'}
          </button>
        </div>

        {/* ייבוא נתונים */}
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-5 md:p-6 shadow-lg border-2 border-blue-200 dark:border-blue-900/50 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex-shrink-0">
              <Upload className="w-7 h-7 md:w-8 md:h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">ייבוא נתונים</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">שחזר גיבוי קודם</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm">
            טען קובץ גיבוי קודם ושחזר את כל הנתונים.
          </p>
          <label className={`block w-full py-2.5 md:py-3 px-4 rounded-lg transition-colors font-medium text-center text-sm ${
            isImporting
              ? 'bg-blue-400 cursor-wait text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
          }`}>
            {isImporting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                מייבא...
              </span>
            ) : '📤 בחר קובץ לייבוא'}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              disabled={isImporting}
            />
          </label>
        </div>

        {/* נקה נתונים */}
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-xl p-5 md:p-6 shadow-lg border-2 border-red-200 dark:border-red-900/50 md:col-span-2 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl flex-shrink-0">
              <Trash2 className="w-7 h-7 md:w-8 md:h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">נקה את כל הנתונים</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">מחיקה מלאה של המערכת</p>
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border-r-4 border-red-500 dark:border-red-600 p-4 mb-4 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 dark:text-red-400 font-medium text-sm">אזהרה!</p>
                <p className="text-red-700 dark:text-red-300 text-sm">
                  פעולה זו תמחק את כל ההכנסות, ההוצאות, התקציב, היעדים והקטגוריות מ-Firestore. לא ניתן לשחזר ללא גיבוי!
                </p>
              </div>
            </div>
          </div>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-red-600 text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
            >
              🗑️ מחק את כל הנתונים
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleClearAll}
                disabled={isClearing}
                className="flex-1 bg-red-600 text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isClearing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />מוחק...</>
                ) : '✅ אישור - מחק הכל'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isClearing}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
              >
                ❌ ביטול
              </button>
            </div>
          )}
        </div>
      </div>

      {/* טיפים */}
      <div className="gsap-card mt-6 md:mt-8 bg-gradient-to-r from-[#e5007e] to-[#ff4da6] dark:from-[#b30062] dark:to-[#e5007e] rounded-xl p-5 md:p-6 text-white shadow-md transition-colors">
        <h3 className="text-lg md:text-xl font-bold mb-3">💡 טיפים</h3>
        <ul className="space-y-2 text-sm">
          <li>• ייצא את הנתונים באופן קבוע לגיבוי</li>
          <li>• שמור את קובץ הגיבוי במקום בטוח (Google Drive, Dropbox)</li>
          <li>• לפני מחיקת נתונים — ודא שיש לך גיבוי!</li>
          <li>• קובץ הגיבוי כולל את כל המידע והקטגוריות המותאמות אישית</li>
          <li>• הנתונים מסונכרנים ל-Firebase ונגישים מכל מכשיר</li>
        </ul>
      </div>
    </div>
  );
}
