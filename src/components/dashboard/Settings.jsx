// src/components/dashboard/Settings.jsx
import {
  Settings as SettingsIcon, Trash2, Download, Upload,
  AlertTriangle, LogOut, Clock, Globe, Copy, Check, ExternalLink,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, query, where, writeBatch, getDoc, setDoc,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import BusinessHoursSettings from './BusinessHoursSettings';


const USER_COLLECTIONS = [
  'incomes', 'expenses', 'goals', 'budgets',
  'categories', 'categoryBudgets',
  'transactions', 'appointments', 'services',
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


function ToggleSwitch({ enabled, onToggle, loading }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-7 w-12 items-center rounded-full
                  transition-colors duration-200 focus:outline-none
                  disabled:opacity-50
                  ${enabled ? 'bg-[#e5007e]' : 'bg-gray-300 dark:bg-gray-600'}`}>
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white
                    shadow-md transition-transform duration-200
                    ${enabled ? 'translate-x-1' : 'translate-x-6'}`}
      />
    </button>
  );
}


function BookingLinkCard() {
  const [copied, setCopied] = useState(false);
  const uid = auth.currentUser?.uid;
  const bookingUrl = uid ? `${window.location.origin}/book/${uid}` : null;

  const handleCopy = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = bookingUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpen = () => {
    if (bookingUrl) window.open(bookingUrl, '_blank');
  };

  if (!uid) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5
                    shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-pink-50 dark:bg-pink-900/30 rounded-xl shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#e5007e]"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm">
              הלינק האישי שלי
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              שתפי עם לקוחות לקביעת תורים אונליין
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30
                        px-2.5 py-1 rounded-full shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">
            פעיל
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50
                      border border-gray-200 dark:border-gray-600
                      rounded-xl px-3 py-2.5 mb-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1"
              dir="ltr">
          {bookingUrl}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                      text-sm font-semibold transition-all duration-200 ${
            copied
              ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
              : 'bg-[#e5007e] hover:bg-[#b30062] text-white shadow-md shadow-[#e5007e]/20'
          }`}>
          {copied
            ? <><Check className="w-4 h-4" /> הועתק!</>
            : <><Copy className="w-4 h-4" /> העתק קישור</>
          }
        </button>
        <button
          onClick={handleOpen}
          title="פתח דף בוקינג"
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300
                     hover:bg-gray-50 dark:hover:bg-gray-700
                     transition-colors text-sm">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


// ── Settings ───────────────────────────────────────────────────────────────
export default function Settings() {
  const { showToast } = useToast();

  const [activeTab,    setActiveTab]    = useState('hours');
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [isExporting,  setIsExporting]  = useState(false);
  const [isImporting,  setIsImporting]  = useState(false);
  const [isClearing,   setIsClearing]   = useState(false);

  const [autoConfirm,     setAutoConfirm]     = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingToggle,    setSavingToggle]    = useState(false);

  // ✅ שלב 1: state חדשים להודעות
  const [welcomeMessage,      setWelcomeMessage]      = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [savingMessages,      setSavingMessages]      = useState(false);

  const containerRef = useRef(null);

  // ✅ שלב 2: טעינת הודעות ב-useEffect הקיים
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'userSettings', uid));
        if (snap.exists()) {
          setAutoConfirm(snap.data().autoConfirm ?? false);
          // ✅ טעינת הודעות מ-Firestore
          setWelcomeMessage(snap.data().welcomeMessage ?? '');
          setConfirmationMessage(snap.data().confirmationMessage ?? '');
        }
      } catch (err) {
        console.error('[Settings] load:', err);
      } finally {
        setLoadingSettings(false);
      }
    };
    load();
  }, []);

  const handleToggleAutoConfirm = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const newVal = !autoConfirm;
    setSavingToggle(true);
    try {
      await setDoc(
        doc(db, 'userSettings', uid),
        { autoConfirm: newVal },
        { merge: true }
      );
      setAutoConfirm(newVal);
      showToast(
        newVal
          ? '✅ תורים יאושרו אוטומטית מהאתר'
          : '🔔 תורים ידרשו אישור ידני שלך',
        'success'
      );
    } catch (err) {
      console.error('[Settings] autoConfirm toggle:', err);
      showToast('שגיאה בשמירת ההגדרה', 'error');
    } finally {
      setSavingToggle(false);
    }
  };

  // ✅ שלב 3: פונקציית שמירת הודעות
  const handleSaveMessages = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSavingMessages(true);
    try {
      await setDoc(
        doc(db, 'userSettings', uid),
        { welcomeMessage, confirmationMessage },
        { merge: true }
      );
      showToast('✅ ההודעות נשמרו בהצלחה', 'success');
    } catch (err) {
      console.error('[Settings] saveMessages:', err);
      showToast('שגיאה בשמירת ההודעות', 'error');
    } finally {
      setSavingMessages(false);
    }
  };

  useGSAP(() => {
    gsap.from('.gsap-card', {
      y: 30, opacity: 0, duration: 0.5,
      stagger: 0.1, ease: 'power2.out', clearProps: 'all',
    });
  }, { scope: containerRef, dependencies: [] });

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
      const blob = new Blob([JSON.stringify(exportData, null, 2)],
        { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `BeautyFlow_backup_${new Date()
        .toLocaleDateString('he-IL').replace(/\//g, '-')}.json`;
      link.click();
      showToast('הנתונים יוצאו בהצלחה! 📥', 'success');
    } catch (error) {
      console.error(error);
      showToast('שגיאה בייצוא הנתונים', 'error');
    } finally {
      setIsExporting(false);
    }
  };

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
    <div className="pt-2 pb-8 px-4 md:p-8 transition-colors"
         ref={containerRef} dir="rtl">

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
          active={activeTab === 'booking'}
          onClick={() => setActiveTab('booking')}
          icon={<Globe className="w-4 h-4" />}
          label="הזמנות אונליין"
        />
        <Tab
          active={activeTab === 'data'}
          onClick={() => setActiveTab('data')}
          icon={<Download className="w-4 h-4" />}
          label="גיבוי ונתונים"
        />
      </div>

      {/* ── Tab: שעות פעילות ──────────────────────────────────────────── */}
      {activeTab === 'hours' && (
        <div className="gsap-card">
          <BusinessHoursSettings />
        </div>
      )}

      {/* ── Tab: הזמנות אונליין ───────────────────────────────────────── */}
      {activeTab === 'booking' && (
        <div className="space-y-4">

          {/* ✅ הלינק האישי */}
          <BookingLinkCard />

          {/* אישור אוטומטי */}
          <div className="gsap-card bg-white dark:bg-gray-800 rounded-2xl p-5
                          shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-3 bg-pink-50 dark:bg-pink-900/30 rounded-xl shrink-0">
                <Globe className="w-6 h-6 text-[#e5007e]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  הגדרות דף הבוקינג
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  שלטי על איך תורים מהאינטרנט מתנהלים
                </p>
              </div>
            </div>

            {loadingSettings ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-[#e5007e]
                                border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4
                                bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="flex-1 ml-4">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                      אישור תורים אוטומטי מהאתר
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {autoConfirm
                        ? '✅ תורים נכנסים ישר ליומן ללא אישור ידני'
                        : '🔔 כל תור ממתין לאישורך במסך הבקשות'}
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={autoConfirm}
                    onToggle={handleToggleAutoConfirm}
                    loading={savingToggle}
                  />
                </div>

                <div className={`p-4 rounded-xl border text-sm transition-colors
                  ${autoConfirm
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}>
                  <p className={`font-semibold mb-1 ${
                    autoConfirm
                      ? 'text-green-800 dark:text-green-300'
                      : 'text-blue-800 dark:text-blue-300'
                  }`}>
                    {autoConfirm ? '⚡ מצב טייס אוטומטי פעיל' : '👀 מצב אישור ידני פעיל'}
                  </p>
                  <p className={`text-xs leading-relaxed ${
                    autoConfirm
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-blue-700 dark:text-blue-400'
                  }`}>
                    {autoConfirm
                      ? 'לקוחות שקובעות תור דרך הלינק הציבורי שלך — התור נכנס ישירות ליומן ונוצר כרטיס לקוחה ב-CRM, הכל ללא התערבות שלך.'
                      : 'כל בקשת תור מהלינק הציבורי מחכה לך במסך "בקשות תורים". את מאשרת או דוחה כל בקשה בנפרד.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ✅ שלב 4: כרטיס הודעות לדף הזמנה אונליין */}
          <div className="gsap-card bg-white dark:bg-gray-800 rounded-2xl p-5
                          shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-3 bg-pink-50 dark:bg-pink-900/30 rounded-xl shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#e5007e]"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  הודעות לדף הזמנה אונליין
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  טקסטים שיופיעו ללקוחה לאחר קביעת התור
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* הודעת המתנה */}
              <div>
                <label className="block text-sm font-semibold text-gray-700
                                   dark:text-gray-300 mb-1.5">
                  הודעת סיום (כשהתור ממתין לאישור)
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  ברירת מחדל: "ניצור קשר בהקדם לאישור סופי 💅"
                </p>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="ניצור קשר בהקדם לאישור סופי 💅"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200
                             dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50
                             text-sm text-gray-800 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-[#e5007e]/30
                             resize-none"
                  dir="rtl"
                />
                <p className="text-xs text-gray-400 mt-1 text-left">
                  {welcomeMessage.length}/200
                </p>
              </div>

              {/* הודעת אישור אוטומטי */}
              <div>
                <label className="block text-sm font-semibold text-gray-700
                                   dark:text-gray-300 mb-1.5">
                  הודעת אישור (כשהתור אושר אוטומטית)
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  ברירת מחדל: "מצפות לראות אותך! 💅"
                </p>
                <textarea
                  value={confirmationMessage}
                  onChange={(e) => setConfirmationMessage(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="מצפות לראות אותך! 💅"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200
                             dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50
                             text-sm text-gray-800 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-[#e5007e]/30
                             resize-none"
                  dir="rtl"
                />
                <p className="text-xs text-gray-400 mt-1 text-left">
                  {confirmationMessage.length}/200
                </p>
              </div>

              <button
                onClick={handleSaveMessages}
                disabled={savingMessages}
                className="w-full bg-[#e5007e] hover:bg-[#b30062] text-white
                           py-2.5 rounded-xl font-semibold text-sm
                           transition-colors disabled:opacity-60
                           flex items-center justify-center gap-2">
                {savingMessages ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white
                                     border-t-transparent rounded-full animate-spin" />
                    שומר...
                  </>
                ) : '💾 שמור הודעות'}
              </button>
            </div>
          </div>

          {/* כרטיס מידע */}
          <div className="gsap-card bg-gradient-to-r from-[#e5007e] to-[#ff4da6]
                          dark:from-[#b30062] dark:to-[#e5007e]
                          rounded-2xl p-5 text-white shadow-md">
            <h3 className="font-bold mb-3">💡 מתי להשתמש בכל מצב?</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="shrink-0">⚡</span>
                <span><strong>אוטומטי</strong> — מתאים אם לוח הזמנים שלך קבוע ואת סומכת על המערכת</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0">👀</span>
                <span><strong>ידני</strong> — מתאים אם את רוצה לבדוק כל לקוחה לפני אישור</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0">🔔</span>
                <span>בשני המצבים תקבלי Badge אדום בתפריט כשמגיעות בקשות חדשות</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Tab: גיבוי ונתונים ────────────────────────────────────────── */}
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
