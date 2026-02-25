// src/components/BookingPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// דף קביעת תור ציבורי — נגיש ללא התחברות
// URL: /book/:providerId
// Flow: בחירת שירות → תאריך + שעה → פרטים → אישור
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  useBookingPage,
  toMin, toTimeStr, parseDateStr, toDateStr,
} from '../hooks/useBookingPage';
import {
  Calendar, Clock, User, Phone, CheckCircle,
  ChevronRight, Store, FileText, AlertCircle, Sparkles,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const HE_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const HE_MONTHS     = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

function getDates(numDays = 21) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: numDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

function isValidPhone(phone) {
  return /^0[0-9]{1,2}[-\s]?[0-9]{7}$/.test(phone.replace(/\s/g, ''));
}

// ── StepIndicator ─────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ['טיפול', 'מועד', 'פרטים'];
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {steps.map((label, i) => {
        const idx    = i + 1;
        const active = step === idx;
        const done   = step > idx;
        return (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center
                              text-xs font-bold transition-all duration-300 ${
                done   ? 'bg-white text-[#e5007e]' :
                active ? 'bg-white text-[#e5007e] ring-2 ring-white/50' :
                         'bg-white/20 text-white/60'
              }`}>
                {done ? '✓' : idx}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-all ${
                active || done ? 'text-white' : 'text-white/50'
              }`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 rounded mb-4 transition-all duration-300 ${
                done ? 'bg-white' : 'bg-white/25'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ErrorScreen ───────────────────────────────────────────────────────────────

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6" dir="rtl">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">שגיאה בטעינת הדף</h2>
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    </div>
  );
}

// ── BookingPage ───────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { providerId } = useParams();

  const [step, setStep] = useState(1);

  const {
    providerSettings, services,
    loadingInitial, errorInitial,
    loadingSlots, submitting,
    fetchBookedSlots, calculateAvailableSlots,
    submitBookingRequest,
  } = useBookingPage(providerId);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate,    setSelectedDate]    = useState(toDateStr(new Date()));
  const [selectedTime,    setSelectedTime]    = useState(null);
  const [guestName,       setGuestName]       = useState('');
  const [guestPhone,      setGuestPhone]      = useState('');
  const [notes,           setNotes]           = useState('');

  const [availableSlots, setAvailableSlots] = useState([]);
  const [submitError,    setSubmitError]    = useState(null);
  const [phoneError,     setPhoneError]     = useState('');

  const datesList = useMemo(() => getDates(21), []);

  // ── שליפת slots בשינוי תאריך ───────────────────────────────────
  const handleDateChange = useCallback(async (newDate, service) => {
    setSelectedDate(newDate);
    setSelectedTime(null);
    if (!service) return;
    const fresh = await fetchBookedSlots(newDate);
    setAvailableSlots(calculateAvailableSlots(newDate, service.duration, fresh));
  }, [fetchBookedSlots, calculateAvailableSlots]);

  // מאזינים רק ל-step בלבד!
  useEffect(() => {
    if (step === 2 && selectedService) {
      handleDateChange(selectedDate, selectedService);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── שליחת בקשת תור ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!isValidPhone(guestPhone)) {
      setPhoneError('מספר טלפון לא תקין (דוגמה: 050-1234567)');
      return;
    }
    setPhoneError('');
    setSubmitError(null);

    try {
      await submitBookingRequest({
        serviceId:    selectedService.id,
        serviceTitle: selectedService.title,
        duration:     selectedService.duration,
        price:        selectedService.price,
        date:         selectedDate,
        startTime:    selectedTime,
        endTime:      toTimeStr(toMin(selectedTime) + Number(selectedService.duration)),
        guestName:    guestName.trim(),
        guestPhone:   guestPhone.trim(),
        notes:        notes.trim(),
      });
      setStep(4);
    } catch (err) {
      setSubmitError(err.message || 'שגיאה בשליחת הבקשה. אנא נסי שוב.');
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  if (loadingInitial) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#e5007e] border-t-transparent
                        rounded-full animate-spin" />
        <p className="text-sm text-gray-400">טוענת פרטי העסק...</p>
      </div>
    </div>
  );

  if (errorInitial) return <ErrorScreen message={errorInitial} />;

  const businessName = providerSettings?.businessName || 'קביעת תור';

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50
                    flex justify-center items-start sm:items-center
                    p-0 sm:p-4 font-sans"
         dir="rtl">

      <div className="w-full max-w-md bg-white flex flex-col
                      min-h-screen sm:min-h-0
                      sm:rounded-3xl sm:shadow-2xl sm:shadow-pink-200/40
                      overflow-hidden relative">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-[#e5007e] to-[#b30062]
                        text-white px-6 pt-6 pb-5 shrink-0 relative z-10">
          <div className="flex items-center">
            {step > 1 && step < 4 && (
              <button
                onClick={() => { setStep(step - 1); setSubmitError(null); }}
                className="ml-3 p-1.5 rounded-full bg-white/20
                           hover:bg-white/30 transition-colors shrink-0">
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-11 h-11 bg-white rounded-2xl flex items-center
                              justify-center shadow-lg shrink-0">
                <Store className="w-5 h-5 text-[#e5007e]" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{businessName}</h1>
                <p className="text-pink-200 text-xs mt-0.5">
                  {step === 1 && 'בחרי טיפול להתחיל'}
                  {step === 2 && selectedService?.title}
                  {step === 3 && 'פרטים אחרונים'}
                  {step === 4 && 'הבקשה נשלחה! 🎉'}
                </p>
              </div>
            </div>
          </div>
          {step < 4 && <StepIndicator step={step} />}
        </div>

        {/* ── תוכן ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30">

          {/* ═══ שלב 1: בחירת שירות ══════════════════════════════ */}
          {step === 1 && (
            <div className="p-4 space-y-3 pb-10">
              {services.length === 0 ? (
                <div className="text-center py-16">
                  <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">אין שירותים זמינים כרגע</p>
                  <p className="text-gray-400 text-sm mt-1">נסי שוב מאוחר יותר</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 font-medium px-1 pt-2 pb-1">
                    {services.length} טיפולים זמינים
                  </p>
                  {services.map((srv) => (
                    <button
                      key={srv.id}
                      onClick={() => { setSelectedService(srv); setStep(2); }}
                      className="w-full bg-white border border-gray-100 p-4 rounded-2xl
                                 shadow-sm hover:border-pink-300 hover:shadow-md
                                 hover:-translate-y-0.5 transition-all cursor-pointer
                                 text-right group">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-base">
                            {srv.title}
                          </span>
                          <span className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            {srv.duration} דקות
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-[#e5007e] text-lg">
                            ₪{Number(srv.price).toLocaleString('he-IL')}
                          </span>
                          <span className="text-xs text-gray-300 group-hover:text-[#e5007e]
                                           transition-colors font-medium">
                            לחצי לבחירה ←
                          </span>
                        </div>
                      </div>
                      {srv.color && (
                        <div className="mt-3 h-1 rounded-full opacity-40"
                             style={{ backgroundColor: srv.color }} />
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ═══ שלב 2: תאריך + שעה ══════════════════════════════ */}
          {step === 2 && (
            <div className="flex flex-col relative"
                 style={{ minHeight: 'calc(100vh - 180px)' }}>

              {/* סרגל תאריכים */}
              <div className="px-4 pt-4 pb-2 bg-white border-b border-gray-100 shrink-0">
                <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#e5007e]" />
                  בחרי תאריך
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2"
                     style={{ scrollbarWidth: 'none' }}>
                  {datesList.map((d) => {
                    const dStr     = toDateStr(d);
                    const isSel    = selectedDate === dStr;
                    const dayCfg   = providerSettings?.businessHours?.[d.getDay()];
                    const isClosed = providerSettings?.closedDays?.includes(dStr)
                                     || !dayCfg || !dayCfg.isActive;
                    return (
                      <button key={dStr}
                        onClick={() => handleDateChange(dStr, selectedService)}
                        className={`flex flex-col items-center justify-center
                                    min-w-[62px] py-3 px-2 rounded-2xl border
                                    transition-all shrink-0 ${
                          isSel
                            ? 'bg-[#e5007e] border-[#e5007e] text-white shadow-lg shadow-pink-400/30 scale-105'
                            : isClosed
                            ? 'bg-gray-50 border-gray-100 text-gray-300 opacity-60'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-pink-200 hover:bg-pink-50'
                        }`}>
                        <span className={`text-[10px] font-semibold ${
                          isSel ? 'text-pink-100' : isClosed ? 'text-gray-300' : 'text-gray-400'
                        }`}>
                          {HE_DAYS_SHORT[d.getDay()]}
                        </span>
                        <span className="text-xl font-bold my-0.5">{d.getDate()}</span>
                        <span className={`text-[10px] ${isSel ? 'text-pink-200' : 'text-gray-400'}`}>
                          {HE_MONTHS[d.getMonth()]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* רשת שעות */}
              <div className="flex-1 overflow-y-auto p-4 pb-32">
                <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#e5007e]" />
                  שעות פנויות
                  {!loadingSlots && availableSlots.length > 0 && (
                    <span className="text-[#e5007e] font-bold">
                      ({availableSlots.length})
                    </span>
                  )}
                </p>

                {loadingSlots ? (
                  <div className="flex justify-center py-12">
                    <div className="w-7 h-7 border-2 border-[#e5007e]
                                    border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl
                                  border border-dashed border-gray-200">
                    <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">אין שעות פנויות ביום זה</p>
                    <p className="text-gray-400 text-xs mt-1">נסי לבחור תאריך אחר</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {availableSlots.map((time) => (
                      <button key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-3.5 rounded-2xl font-bold text-base
                                    transition-all duration-200 ${
                          selectedTime === time
                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20 scale-105'
                            : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-800 hover:bg-gray-50'
                        }`}>
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* כפתור המשך */}
              {selectedTime && (
                <div className="absolute bottom-0 left-0 right-0 p-4
                                bg-gradient-to-t from-white via-white to-transparent
                                border-t border-gray-100">
                  <div className="bg-pink-50 rounded-xl px-4 py-2.5 mb-3
                                  flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {parseDateStr(selectedDate).toLocaleDateString('he-IL', {
                        day: 'numeric', month: 'long',
                      })}
                    </span>
                    <span className="font-bold text-[#e5007e]">🕐 {selectedTime}</span>
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="w-full bg-[#e5007e] hover:bg-[#b30062] text-white
                               py-4 rounded-2xl font-bold text-base
                               shadow-lg shadow-pink-500/30 transition-all active:scale-95">
                    המשך לפרטים אישיים ←
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══ שלב 3: פרטי לקוחה ════════════════════════════════ */}
          {step === 3 && (
            <div className="p-4 pb-10">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 shadow-sm">
                <p className="text-xs text-gray-400 font-medium mb-2">סיכום הבקשה שלך</p>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800">{selectedService?.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {parseDateStr(selectedDate).toLocaleDateString('he-IL', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {selectedTime} · {selectedService?.duration} דקות
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-xl text-[#e5007e]">
                      ₪{Number(selectedService?.price).toLocaleString('he-IL')}
                    </p>
                    <button onClick={() => setStep(2)}
                      className="text-xs text-gray-400 hover:text-[#e5007e]
                                 underline transition-colors mt-1">
                      שני
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#e5007e]" />
                      שם מלא <span className="text-[#e5007e]">*</span>
                    </span>
                  </label>
                  <input type="text" required autoFocus
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="שם ושם משפחה"
                    className="w-full p-3.5 rounded-xl border border-gray-200 bg-white
                               focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e]
                               outline-none transition-all text-base" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-[#e5007e]" />
                      טלפון נייד <span className="text-[#e5007e]">*</span>
                    </span>
                  </label>
                  <input type="tel" required dir="ltr"
                    value={guestPhone}
                    onChange={(e) => { setGuestPhone(e.target.value); setPhoneError(''); }}
                    placeholder="050-0000000"
                    className={`w-full p-3.5 rounded-xl border bg-white focus:ring-1
                                outline-none transition-all text-base text-right ${
                      phoneError
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                        : 'border-gray-200 focus:border-[#e5007e] focus:ring-[#e5007e]'
                    }`} />
                  {phoneError && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />{phoneError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#e5007e]" />
                      הערות (אופציונלי)
                    </span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="יש משהו חשוב שכדאי שנדע?"
                    rows={3}
                    maxLength={300}
                    className="w-full p-3.5 rounded-xl border border-gray-200 bg-white
                               focus:border-[#e5007e] focus:ring-1 focus:ring-[#e5007e]
                               outline-none transition-all resize-none text-base" />
                  <p className="text-xs text-gray-300 text-left mt-0.5">
                    {notes.length}/300
                  </p>
                </div>

                {submitError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl
                                  bg-red-50 border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-red-600 text-sm">{submitError}</p>
                  </div>
                )}

                <button type="submit"
                  disabled={submitting || !guestName.trim() || !guestPhone.trim()}
                  className="w-full bg-[#e5007e] hover:bg-[#b30062] text-white
                             py-4 rounded-2xl font-bold text-base mt-2
                             shadow-lg shadow-pink-500/30 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white
                                       border-t-transparent rounded-full animate-spin" />
                      שולחת בקשה...
                    </span>
                  ) : 'שלחי בקשה לתור ✨'}
                </button>
              </form>
            </div>
          )}

          {/* ═══ שלב 4: הצלחה ════════════════════════════════════ */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center
                            text-center px-6 py-16 min-h-[60vh]">
              <div className="w-24 h-24 bg-green-100 rounded-full
                              flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">הבקשה נשלחה! 🎉</h2>
              <p className="text-gray-500 leading-relaxed mb-2">
                הבקשה לתור ב-
                <span className="font-semibold text-gray-700">
                  {parseDateStr(selectedDate).toLocaleDateString('he-IL', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </span>
                {' '}בשעה{' '}
                <span className="font-semibold text-gray-700">{selectedTime}</span>
                {' '}התקבלה.
              </p>
              <p className="text-gray-400 text-sm mb-8">
                ניצור קשר בהקדם לאישור סופי 💅
              </p>

              {/* ✅ כפתור הוספה ליומן הטלפון */}
              <button
                onClick={() => {
                  // ✅ בניית קובץ .ics תקני
                  const [y, m, d]   = selectedDate.split('-').map(Number);
                  const [hh, mm]    = selectedTime.split(':').map(Number);
                  const endMin      = toMin(selectedTime) + Number(selectedService?.duration);
                  const endHH       = Math.floor(endMin / 60);
                  const endMM       = endMin % 60;
                  
                  // פורמט ICS: YYYYMMDDTHHMMSS
                  const pad  = (n) => String(n).padStart(2, '0');
                  const dtStart = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
                  const dtEnd   = `${y}${pad(m)}${pad(d)}T${pad(endHH)}${pad(endMM)}00`;
                  
                  const icsContent = [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//BeautyFlow//BookingPage//HE',
                    'BEGIN:VEVENT',
                    `DTSTART:${dtStart}`,
                    `DTEND:${dtEnd}`,
                    `SUMMARY:תור ל${selectedService?.title} — ${businessName}`,
                    `DESCRIPTION:טיפול: ${selectedService?.title}\\nמחיר: ₪${selectedService?.price}\\nמשך: ${selectedService?.duration} דקות`,
                    `LOCATION:${businessName}`,
                    'STATUS:TENTATIVE', // ממתין לאישור
                    'END:VEVENT',
                    'END:VCALENDAR',
                  ].join('\r\n');
                  
                  // יצירת קישור הורדה
                  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement('a');
                  a.href     = url;
                  a.download = 'appointment.ics';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full bg-[#e5007e] hover:bg-[#b30062] text-white
                           font-bold px-8 py-4 rounded-2xl transition-colors
                           shadow-lg shadow-pink-500/30 flex items-center
                           justify-center gap-2 text-base mb-3">
                <Calendar className="w-5 h-5" />
                הוסיפי ליומן 📅
              </button>
              
              <p className="text-gray-400 text-xs mt-2 underline cursor-pointer hover:text-gray-600 transition-colors" onClick={() => window.location.reload()}>
                קביעת תור נוסף
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}