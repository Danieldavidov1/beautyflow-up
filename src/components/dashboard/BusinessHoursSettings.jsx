// src/components/dashboard/BusinessHoursSettings.jsx
import { useState, useCallback } from 'react';
import { Clock, Store, Phone, Calendar, Save, RotateCcw } from 'lucide-react';
import { useBusinessSettings, DEFAULT_BUSINESS_HOURS } from '../../hooks/useBusinessSettings';
import { useToast } from '../../context/ToastContext';

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const inputCls = `w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600
  bg-white dark:bg-gray-700 dark:text-white text-sm outline-none
  focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all
  disabled:opacity-40 disabled:cursor-not-allowed`;

// ── DayRow — שורה לכל יום ─────────────────────────────────────────────────
function DayRow({ dayIndex, config, onChange }) {
  const isWeekend = dayIndex === 5 || dayIndex === 6; // שישי/שבת

  return (
    <div className={`flex items-center gap-2 sm:gap-4 p-3 rounded-xl transition-all ${
      config.isActive
        ? 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm'
        : 'bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-700 opacity-70'
    }`}>

      {/* Toggle יום פעיל */}
      <button
        type="button"
        onClick={() => onChange(dayIndex, 'isActive', !config.isActive)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                    border-2 border-transparent transition-colors duration-200
                    focus:outline-none ${
          config.isActive
            ? 'bg-[#e5007e]'
            : 'bg-gray-300 dark:bg-gray-600'
        }`}
        title={config.isActive ? 'לחץ לסגירת יום' : 'לחץ לפתיחת יום'}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full
                          bg-white shadow-lg ring-0 transition-transform duration-200 ${
          config.isActive ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>

      {/* שם היום */}
      <span className={`w-14 shrink-0 text-sm font-bold ${
        config.isActive
          ? isWeekend
            ? 'text-[#e5007e]'
            : 'text-gray-800 dark:text-white'
          : 'text-gray-400 dark:text-gray-500'
      }`}>
        {HE_DAYS[dayIndex]}
      </span>

      {config.isActive ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* שעת התחלה */}
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-gray-400 mb-0.5 font-medium">פתיחה</label>
            <input
              type="time"
              value={config.start}
              onChange={(e) => onChange(dayIndex, 'start', e.target.value)}
              className={inputCls}
            />
          </div>

          <span className="text-gray-300 dark:text-gray-600 text-sm shrink-0 mt-3">—</span>

          {/* שעת סיום */}
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] text-gray-400 mb-0.5 font-medium">סגירה</label>
            <input
              type="time"
              value={config.end}
              onChange={(e) => onChange(dayIndex, 'end', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* סיכום שעות */}
          <div className="hidden sm:flex items-center gap-1 shrink-0 mt-3">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {(() => {
                const [sh, sm] = config.start.split(':').map(Number);
                const [eh, em] = config.end.split(':').map(Number);
                const diff = (eh * 60 + em) - (sh * 60 + sm);
                if (diff <= 0) return '—';
                return diff >= 60
                  ? `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')} ש'`
                  : `${diff} דק'`;
              })()}
            </span>
          </div>
        </div>
      ) : (
        <span className="flex-1 text-xs text-gray-400 dark:text-gray-500 mr-1">
          סגור
        </span>
      )}
    </div>
  );
}

// ── BusinessHoursSettings — קומפוננט ראשי ─────────────────────────────────
export default function BusinessHoursSettings() {
  const {
    businessHours,
    businessName,
    businessPhone,
    loading,
    updateBusinessHours,
    updateGeneralSettings,
  } = useBusinessSettings();

  const { showToast } = useToast();

  // state מקומי לעריכה (לא שומר עד לחיצה על "שמור")
  const [localHours,   setLocalHours]   = useState(null);
  const [localName,    setLocalName]    = useState('');
  const [localPhone,   setLocalPhone]   = useState('');
  const [saving,       setSaving]       = useState(false);
  const [initialized,  setInitialized]  = useState(false);

  // אתחול state מקומי ברגע שה-hook נטען
  if (!loading && !initialized) {
    setLocalHours({ ...businessHours });
    setLocalName(businessName);
    setLocalPhone(businessPhone);
    setInitialized(true);
  }

  // שינוי יום בודד
  const handleDayChange = useCallback((dayIndex, field, value) => {
    setLocalHours((prev) => ({
      ...prev,
      [dayIndex]: { ...prev[dayIndex], [field]: value },
    }));
  }, []);

  // איפוס לברירות מחדל
  const handleReset = () => {
    setLocalHours({ ...DEFAULT_BUSINESS_HOURS });
    showToast('השעות אופסו לברירת מחדל', 'info');
  };

  // שמירה
  const handleSave = async () => {
    // וולידציה
    for (const [idx, cfg] of Object.entries(localHours)) {
      if (cfg.isActive && cfg.start >= cfg.end) {
        showToast(`שגיאה: ביום ${HE_DAYS[idx]} שעת הסגירה חייבת להיות אחרי שעת הפתיחה`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      await updateBusinessHours(localHours);
      await updateGeneralSettings({
        businessName:  localName.trim(),
        businessPhone: localPhone.trim(),
      });
      showToast('ההגדרות נשמרו בהצלחה ✓', 'success');
    } catch (err) {
      showToast('שגיאה בשמירת ההגדרות', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !localHours) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-[#e5007e] border-t-transparent
                        rounded-full animate-spin" />
      </div>
    );
  }

  const activeDaysCount = Object.values(localHours).filter((d) => d.isActive).length;

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── פרטי העסק ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border
                      border-gray-100 dark:border-gray-700 shadow-sm">
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
          <Store className="w-4 h-4 text-[#e5007e]" />
          פרטי העסק
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500
                              dark:text-gray-400 mb-1">
              שם העסק
            </label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="למשל: ציפורניים של רחל"
              className={inputCls}
              maxLength={60}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500
                              dark:text-gray-400 mb-1">
              טלפון העסק
            </label>
            <div className="relative">
              <Phone className="absolute right-2.5 top-1/2 -translate-y-1/2
                                w-3.5 h-3.5 text-gray-400" />
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => setLocalPhone(e.target.value)}
                placeholder="050-0000000"
                className={`${inputCls} pr-8`}
                dir="ltr"
                maxLength={15}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── שעות פעילות ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border
                      border-gray-100 dark:border-gray-700 shadow-sm">

        {/* כותרת + מונה ימים */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#e5007e]" />
            שעות פעילות
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400
                             bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              {activeDaysCount} ימים פעילים
            </span>
            <button
              type="button"
              onClick={handleReset}
              title="איפוס לברירת מחדל"
              className="p-1.5 text-gray-400 hover:text-[#e5007e]
                         hover:bg-pink-50 dark:hover:bg-pink-900/20
                         rounded-lg transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* שורות ימים */}
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
            <DayRow
              key={dayIndex}
              dayIndex={dayIndex}
              config={localHours[dayIndex]}
              onChange={handleDayChange}
            />
          ))}
        </div>

        {/* הסבר */}
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          היומן יתריע כשתקבעי תור מחוץ לשעות הפעילות
        </p>
      </div>

      {/* ── כפתור שמירה ────────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-[#e5007e] hover:bg-[#b30062]
                   text-white font-bold text-sm transition-all
                   disabled:opacity-60 disabled:cursor-not-allowed
                   shadow-lg shadow-pink-500/20
                   flex items-center justify-center gap-2">
        {saving ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent
                            rounded-full animate-spin" />
            שומר...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            שמור הגדרות
          </>
        )}
      </button>
    </div>
  );
}
