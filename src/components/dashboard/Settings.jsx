// src/components/dashboard/Settings.jsx
import {
  Settings as SettingsIcon, Trash2, Download, Upload,
  AlertTriangle, LogOut, Clock,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, query, where, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import BusinessHoursSettings from './BusinessHoursSettings';

// ── קולקציות לגיבוי/מחיקה ────────────────────────────────────────────────
const USER_COLLECTIONS = [
  'incomes', 'expenses', 'goals', 'budgets',
  'categories', 'categoryBudgets',
  'transactions', 'appointments', 'services',    // ✅ נוספו קולקציות חדשות
];

const BATCH_SIZE = 499;

async function batchDeleteAll(userId) {
  for (const col of USER_COLLECTIONS) {
    const q = query(collection(db, col), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(doc(db, col, d.id)));
      await batch.commit();
    }
  }
}

// ── Tab Component ──────────────────────────────────────────────────────────
function Tab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                  transition-all whitespace-nowrap ${
        active
          ? 'bg-[#e5007e] text-white shadow-md shadow-pink-500/20'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}>
      {icon}
      {label}
    </button>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────
export default function Settings() {
  const { showToast } = useToast();

  const [activeTab,   setActiveTab]   = useState('hours');  // ✅ ברירת מחדל: שעות
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing,  setIsClearing]  = useState(false);

  const containerRef = useRef(null);

  useGSAP(() => {
    gsap.from('.gsap-card', {
      y: 30, opacity: 0, duration: 0.5,
      stagger: 0.1, ease: 'power2.out', clearProps: 'all',
    });
  }, { scope: containerRef, dependencies: [] });

  // ── ייצוא ─────────────────────────────────────────────────────────────
  const handleExportAll = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) { showToast('לא מחובר', 'error'); return; }

    setIsExporting(true);
    try {
      const exportData = { exportDate: new Date().toISOString(), userId };
      for (const col of USER_COLLECTIONS) {
        const q = query(collection(db, col), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        exportData[col] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
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

  // ── ייבוא ─────────────────────────────────────────────────────────────
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
        await batchDeleteAll(userId);
        for (const col of USER_COLLECTIONS) {
          if (data[col]?.length) {
            await Promise.all(
              data[col].map((item) => {
                const { id, ...itemData } = item;
                return addDoc(collection(db, col), { ...itemData, userId });
              })
            );
          }
        }
        ['incomeCategories', 'expenseCategoriesFull', 'goalCategories'].forEach((k) =>
          localStorage.removeItem(k)
        );
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(`seeded_${userId}`)) localStorage.removeItem(key);
        });
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
    event.target.value = '';
  };

  // ── מחיקה ─────────────────────────────────────────────────────────────
  const handleClearAll = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) { showToast('לא מחובר', 'error'); return; }

    setIsClearing(true);
    try {
      await batchDeleteAll(userId);
      ['incomeCategories', 'expenseCategoriesFull', 'goalCategories'].forEach((k) =>
        localStorage.removeItem(k)
      );
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`seeded_${userId}`)) localStorage.removeItem(key);
      });
      showToast('כל הנתונים נמחקו בהצלחה! 🗑️', 'success');
      setShowConfirm(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error(error);
      showToast('שגיאה במחיקת הנתונים', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('התנתקת בהצלחה', 'success');
    } catch {
      showToast('שגיאה בהתנתקות', 'error');
    }
  };

  return (
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors" ref={containerRef} dir="rtl">

      {/* ── כותרת ─────────────────────────────────────────────────────── */}
      <div className="gsap-card mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
          הגדרות ⚙️
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          הגדרות עסק, שעות פעילות וניהול נתונים
        </p>
      </div>

      {/* ── פרופיל משתמש ──────────────────────────────────────────────── */}
      {auth.currentUser && (
        <div className="gsap-card bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm
                        border border-gray-100 dark:border-gray-700 mb-6
                        flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br
                            from-[#e5007e] to-[#ff4da6]
                            flex items-center justify-center
                            text-white font-bold text-lg shrink-0">
              {auth.currentUser.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {auth.currentUser.displayName || 'משתמש'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {auth.currentUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100
                       dark:bg-gray-700 text-gray-700 dark:text-gray-200
                       rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600
                       transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" />
            התנתק
          </button>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="gsap-card flex gap-2 mb-6 overflow-x-auto pb-1">
        <Tab
          active={activeTab === 'hours'}
          onClick={() => setActiveTab('hours')}
          icon={<Clock className="w-4 h-4" />}
          label="שעות פעילות"
        />
        <Tab
          active={activeTab === 'data'}
          onClick={() => setActiveTab('data')}
          icon={<Download className="w-4 h-4" />}
          label="גיבוי ונתונים"
        />
      </div>

      {/* ── תוכן לפי Tab ──────────────────────────────────────────────── */}

      {/* Tab: שעות פעילות */}
      {activeTab === 'hours' && (
        <div className="gsap-card">
          <BusinessHoursSettings />
        </div>
      )}

      {/* Tab: גיבוי ונתונים */}
      {activeTab === 'data' && (
        <div className="space-y-4">

          {/* ייצוא */}
          <div className="gsap-card bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm
                          border-2 border-green-200 dark:border-green-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-xl shrink-0">
                <Download className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">ייצוא נתונים</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">גיבוי של כל המידע שלך</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              שמור את כל הנתונים (הכנסות, הוצאות, תקציב, יעדים, תורים ושירותים) לקובץ JSON.
            </p>
            <button
              onClick={handleExportAll}
              disabled={isExporting}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 px-4
                         rounded-xl font-medium text-sm transition-colors
                         disabled:opacity-60 flex items-center justify-center gap-2">
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent
                                  rounded-full animate-spin" />
                  מייצא...
                </>
              ) : '📥 ייצא את כל הנתונים'}
            </button>
          </div>

          {/* ייבוא */}
          <div className="gsap-card bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm
                          border-2 border-blue-200 dark:border-blue-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl shrink-0">
                <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">ייבוא נתונים</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">שחזר גיבוי קודם</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              טען קובץ גיבוי קודם ושחזר את כל הנתונים. פעולה זו תדרוס נתונים קיימים.
            </p>
            <label className={`block w-full py-2.5 px-4 rounded-xl font-medium
                               text-center text-sm transition-colors ${
              isImporting
                ? 'bg-blue-400 cursor-wait text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
            }`}>
              {isImporting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent
                                   rounded-full animate-spin inline-block" />
                  מייבא...
                </span>
              ) : '📤 בחר קובץ לייבוא'}
              <input type="file" accept=".json"
                onChange={handleImport} className="hidden" disabled={isImporting} />
            </label>
          </div>

          {/* מחיקה */}
          <div className="gsap-card bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm
                          border-2 border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">נקה את כל הנתונים</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">מחיקה מלאה של המערכת</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border-r-4 border-red-500
                            p-4 mb-4 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-red-800 dark:text-red-400 font-semibold text-sm">אזהרה!</p>
                  <p className="text-red-700 dark:text-red-300 text-sm mt-0.5">
                    פעולה זו תמחק את כל ההכנסות, ההוצאות, התקציב, היעדים, התורים והשירותים.
                    לא ניתן לשחזר ללא גיבוי!
                  </p>
                </div>
              </div>
            </div>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4
                           rounded-xl font-medium text-sm transition-colors">
                🗑️ מחק את כל הנתונים
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 px-4
                             rounded-xl font-medium text-sm transition-colors
                             disabled:opacity-60 flex items-center justify-center gap-2">
                  {isClearing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent
                                      rounded-full animate-spin" />
                      מוחק...
                    </>
                  ) : '✅ אישור — מחק הכל'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isClearing}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700
                             dark:text-gray-200 py-2.5 px-4 rounded-xl font-medium
                             text-sm transition-colors hover:bg-gray-200
                             dark:hover:bg-gray-600">
                  ❌ ביטול
                </button>
              </div>
            )}
          </div>

          {/* טיפים */}
          <div className="gsap-card bg-gradient-to-r from-[#e5007e] to-[#ff4da6]
                          dark:from-[#b30062] dark:to-[#e5007e]
                          rounded-2xl p-5 text-white shadow-md">
            <h3 className="font-bold mb-3">💡 טיפים</h3>
            <ul className="space-y-1.5 text-sm">
              <li>• ייצא את הנתונים באופן קבוע לגיבוי</li>
              <li>• שמור את קובץ הגיבוי במקום בטוח (Google Drive)</li>
              <li>• לפני מחיקת נתונים — ודאי שיש גיבוי!</li>
              <li>• הגיבוי כולל תורים, שירותים ועסקאות פיננסיות</li>
              <li>• הנתונים מסונכרנים ב-Firebase ונגישים מכל מכשיר</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
