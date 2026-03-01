// src/components/onboarding/OnboardingWizard.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from '../../firebase';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_BUSINESS_HOURS } from '../../hooks/useBusinessSettings';
import {
  ChevronLeft, ChevronRight, Check, Copy, ExternalLink,
  Clock, Scissors, Sparkles, CheckCircle,
} from 'lucide-react';
import gsap from 'gsap';

// ── קבועים ────────────────────────────────────────────────────────────────

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const STEP_META = [
  { icon: Clock,     label: 'שעות פעילות',           desc: 'מהן שעות הפתיחה שלך?'  },
  { icon: Scissors,  label: 'בואו נגדיר טיפול ראשון!', desc: 'מה תרצו להוסיף?'       },
  { icon: Sparkles,  label: 'הכל מוכן!',              desc: 'הלינק האישי שלך מחכה'  },
];

// ✅ תוקן: price ו-duration כ-string — מאפשר מחיקה חופשית בשדה
const EMPTY_SERVICE = {
  title:    '',
  duration: '60',
  price:    '',
  color:    '#e5007e',
  isActive: true,
};

const inputCls = `w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600
  bg-gray-50 dark:bg-gray-700 dark:text-white text-sm outline-none
  focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e] transition-all`;

// ── StepIndicator ─────────────────────────────────────────────────────────

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center
                           text-xs font-bold transition-all duration-300 ${
            i < current
              ? 'bg-[#e5007e] text-white shadow-md shadow-pink-500/30'
              : i === current
              ? 'bg-[#e5007e] text-white shadow-lg shadow-pink-500/40 ring-4 ring-[#e5007e]/20'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
          }`}>
            {i < current ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 rounded-full transition-all duration-500 ${
              i < current ? 'bg-[#e5007e]' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step1: שעות פעילות ────────────────────────────────────────────────────

function Step1BusinessHours({ hours, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
        תוכלי לשנות זאת בכל עת מתוך ההגדרות
      </p>
      {Array.from({ length: 7 }, (_, i) => {
        const cfg = hours[i];
        return (
          <div key={i}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              cfg.isActive
                ? 'bg-pink-50/50 dark:bg-[#e5007e]/10 border-pink-200 dark:border-[#e5007e]/30'
                : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 opacity-60'
            }`}>

            <button type="button"
              onClick={() => onChange(i, 'isActive', !cfg.isActive)}
              className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${
                cfg.isActive ? 'bg-[#e5007e]' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow
                               transition-all ${cfg.isActive ? 'right-0.5' : 'left-0.5'}`} />
            </button>

            <span className={`text-sm font-bold w-14 shrink-0 ${
              cfg.isActive ? 'text-gray-800 dark:text-white' : 'text-gray-400'
            }`}>
              {HE_DAYS[i]}
            </span>

            {cfg.isActive ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={cfg.start}
                  onChange={(e) => onChange(i, 'start', e.target.value)}
                  className={`${inputCls} text-center`} />
                <span className="text-gray-400 text-xs shrink-0">עד</span>
                <input type="time" value={cfg.end}
                  onChange={(e) => onChange(i, 'end', e.target.value)}
                  className={`${inputCls} text-center`} />
              </div>
            ) : (
              <span className="text-xs text-gray-400 flex-1 text-center">סגור</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step2: טיפול ראשון ────────────────────────────────────────────────────

function Step2FirstService({ service, onChange }) {
  const QUICK_SERVICES = [
    { title: 'מניקור',     duration: '45', price: '80'  },
    { title: 'פדיקור',     duration: '60', price: '100' },
    { title: 'ג\'ל',        duration: '75', price: '120' },
    { title: 'גבות',       duration: '30', price: '60'  },
    { title: 'הסרת שיער', duration: '30', price: '80'  },
    { title: 'פנים',       duration: '60', price: '150' },
  ];

  const COLORS = ['#e5007e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-4">
      {/* בחירה מהירה */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          בחירה מהירה:
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_SERVICES.map((s) => (
            <button key={s.title} type="button"
              onClick={() => onChange({ ...service, title: s.title, duration: s.duration, price: s.price })}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                service.title === s.title
                  ? 'bg-[#e5007e] text-white border-[#e5007e] shadow-sm'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#e5007e]/50'
              }`}>
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* שם */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
          שם הטיפול <span className="text-[#e5007e]">*</span>
        </label>
        <input type="text" value={service.title} placeholder="למשל: מניקור ג׳ל"
          onChange={(e) => onChange({ ...service, title: e.target.value })}
          className={inputCls} autoFocus />
      </div>

      {/* משך + מחיר */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            משך (דקות) <span className="text-[#e5007e]">*</span>
          </label>
          {/* ✅ תוקן: value=string, onChange שומר string — מאפשר מחיקה חופשית */}
          <input
            type="number"
            value={service.duration}
            min={5} max={480} step={5}
            placeholder="60"
            onChange={(e) => onChange({ ...service, duration: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            מחיר (₪) <span className="text-[#e5007e]">*</span>
          </label>
          {/* ✅ תוקן: value=string, onChange שומר string — מאפשר מחיקה ורישום חופשי */}
          <input
            type="number"
            value={service.price}
            min={0}
            placeholder="0"
            onChange={(e) => onChange({ ...service, price: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      {/* צבע */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
          צבע בלוח השנה
        </label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button"
              onClick={() => onChange({ ...service, color: c })}
              style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full transition-all ${
                service.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
              }`} />
          ))}
        </div>
      </div>

      {/* תצוגה מקדימה */}
      {service.title && (
        <div className="p-3 rounded-xl border-2 border-dashed border-[#e5007e]/30
                        bg-pink-50/50 dark:bg-[#e5007e]/10">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">תצוגה מקדימה:</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color }} />
              <span className="text-sm font-bold text-gray-800 dark:text-white">{service.title}</span>
              <span className="text-xs text-gray-400">{service.duration} דק׳</span>
            </div>
            <span className="text-sm font-bold text-[#e5007e]">
              ₪{service.price || 0}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step3: סיכום ──────────────────────────────────────────────────────────

function Step3Summary({ businessName, uid }) {
  const [copied, setCopied] = useState(false);
  const bookingUrl = `${window.location.origin}/book/${uid}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement('input');
      el.value = bookingUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#e5007e] to-[#ff4da6]
                        flex items-center justify-center shadow-xl shadow-pink-500/30
                        animate-bounce">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
          {businessName ? `${businessName} מוכנים לעסקים!` : 'הכל מוכן! 🎉'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          הלינק האישי שלך לקביעת תורים:
        </p>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl
                      border border-gray-200 dark:border-gray-600">
        <p className="text-xs text-[#e5007e] font-mono mb-3 break-all leading-relaxed">
          {bookingUrl}
        </p>
        <div className="flex gap-2">
          <button onClick={handleCopy}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
                        flex items-center justify-center gap-2 ${
              copied
                ? 'bg-green-500 text-white'
                : 'bg-[#e5007e] hover:bg-[#b30062] text-white shadow-lg shadow-pink-500/20'
            }`}>
            {copied
              ? <><Check className="w-4 h-4" /> הועתק!</>
              : <><Copy className="w-4 h-4" /> העתיקי לינק</>}
          </button>
          <a href={bookingUrl} target="_blank" rel="noreferrer"
            className="px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                       text-gray-500 dark:text-gray-400 hover:text-[#e5007e]
                       hover:border-[#e5007e] transition-all flex items-center">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="text-right space-y-2">
        {[
          '📲 שלח/י את הלינק ללקוחות בוואטסאפ',
          '📸 טיפ: כדאי לצרף קישור לביו באינסטגרם',
          '✏️ הוספת עוד טיפולים מתוך "שירותים ומחירון"',
        ].map((tip) => (
          <div key={tip} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OnboardingWizard — Main ───────────────────────────────────────────────

export default function OnboardingWizard({ onComplete }) {
  const { showToast } = useToast();
  const overlayRef    = useRef(null);
  const cardRef       = useRef(null);
  const contentRef    = useRef(null);

  const uid          = auth.currentUser?.uid;
  const businessName = auth.currentUser?.displayName ?? '';

  const [step,   setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  const [hours,   setHours]   = useState(() => ({ ...DEFAULT_BUSINESS_HOURS }));
  const [service, setService] = useState({ ...EMPTY_SERVICE });

  useEffect(() => {
    if (!overlayRef.current || !cardRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: 40, scale: 0.95 },
      { opacity: 1, y: 0,  scale: 1, duration: 0.4, ease: 'power3.out', delay: 0.1 }
    );
  }, []);

  const animateStep = useCallback((direction, callback) => {
    if (!contentRef.current) { callback(); return; }
    const xOut = direction === 'next' ? -60 : 60;
    const xIn  = direction === 'next' ?  60 : -60;
    gsap.to(contentRef.current, {
      x: xOut, opacity: 0, duration: 0.2, ease: 'power2.in',
      onComplete: () => {
        callback();
        gsap.fromTo(contentRef.current,
          { x: xIn, opacity: 0 },
          { x: 0,   opacity: 1, duration: 0.25, ease: 'power2.out' }
        );
      },
    });
  }, []);

  const saveStep1 = useCallback(async () => {
    if (!uid) return;
    await setDoc(doc(db, 'userSettings', uid),
      { businessHours: hours }, { merge: true }
    );
  }, [uid, hours]);

  // ✅ תוקן: המרה למספר נעשית כאן בלבד בעת שמירה — לא ב-onChange
  const saveStep2 = useCallback(async () => {
    if (!uid || !service.title.trim()) return;
    await addDoc(collection(db, 'services'), {
      title:    service.title.trim(),
      price:    Number(service.price)    || 0,
      duration: Number(service.duration) || 60,
      color:    service.color,
      isActive: service.isActive,
      userId:   uid,
    });
  }, [uid, service]);

  const finishOnboarding = useCallback(async () => {
    if (!uid) return;
    await setDoc(doc(db, 'userSettings', uid),
      { onboardingCompleted: true }, { merge: true }
    );
    onComplete();
  }, [uid, onComplete]);

  const handleNext = async () => {
    if (saving) return;
    if (step === 1 && !service.title.trim()) {
      showToast('יש להזין שם לטיפול', 'error'); return;
    }
    setSaving(true);
    try {
      if (step === 0) await saveStep1();
      if (step === 1) await saveStep2();
      if (step === STEP_META.length - 1) {
        await finishOnboarding();
        return;
      }
      animateStep('next', () => setStep((p) => p + 1));
    } catch (err) {
      console.error('[Onboarding]', err);
      showToast('שגיאה בשמירה, נסי שוב', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 0) return;
    animateStep('prev', () => setStep((p) => p - 1));
  };

  const handleHourChange = useCallback((dayIdx, field, value) => {
    setHours((p) => ({ ...p, [dayIdx]: { ...p[dayIdx], [field]: value } }));
  }, []);

  const CurrentIcon = STEP_META[step].icon;

  return (
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      dir="rtl">
      <div ref={cardRef}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl
                   w-full max-w-lg my-4 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-l from-[#e5007e] to-[#ff4da6] p-6 text-white text-center">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl
                            flex items-center justify-center backdrop-blur-sm">
              <CurrentIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-black mb-1">
            {step === 0 ? 'בואו נתחיל להגדיר את החשבון!' : STEP_META[step].label}
          </h1>
          <p className="text-white/80 text-sm">{STEP_META[step].desc}</p>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-5">
          <StepIndicator current={step} total={STEP_META.length} />
        </div>

        {/* Content */}
        <div ref={contentRef} className="px-6 pb-4 min-h-[320px]">
          {step === 0 && <Step1BusinessHours hours={hours} onChange={handleHourChange} />}
          {step === 1 && <Step2FirstService service={service} onChange={setService} />}
          {step === 2 && <Step3Summary businessName={businessName} uid={uid} />}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 0 && step < STEP_META.length - 1 && (
            <button onClick={handleBack}
              className="flex items-center gap-1 px-4 py-3 rounded-xl
                         border border-gray-300 dark:border-gray-600
                         text-gray-600 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
              <ChevronRight className="w-4 h-4" /> חזור
            </button>
          )}
          <button onClick={handleNext} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#e5007e] hover:bg-[#b30062]
                       text-white font-bold text-sm transition-all
                       disabled:opacity-50 shadow-lg shadow-pink-500/20
                       flex items-center justify-center gap-2">
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : step === STEP_META.length - 1 ? (
              <><CheckCircle className="w-4 h-4" /> סיימתי, אל הדשבורד!</>
            ) : (
              <>הבא <ChevronLeft className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {/* Skip */}
        {step < STEP_META.length - 1 && (
          <div className="text-center pb-4">
            <button onClick={finishOnboarding}
              className="text-xs text-gray-400 hover:text-gray-600
                         dark:hover:text-gray-300 underline transition-colors">
              דלג/י על ההגדרות הראשוניות
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
