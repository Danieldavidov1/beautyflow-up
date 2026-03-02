// src/components/dashboard/CalendarView.jsx
import React, { useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// ✅ helper פנימי לקבלת מחרוזת תאריך YYYY-MM-DD
const toDateStrLocal = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const locales = { he };
const startOfWeekFn = (date) => startOfWeek(date, { weekStartsOn: 0 });
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: startOfWeekFn,
  getDay,
  locales,
});

// ✅ פתרון הקסם לבאג של Vite והייצוא הישן (חובה כדי למנוע מסך לבן!):
const withDnD = typeof withDragAndDrop === 'function' ? withDragAndDrop : withDragAndDrop.default;
const DnDCalendar = withDnD(Calendar);

// ── 4. Custom Event Component עם אייקונים ─────────────────────────────────
function CustomEventComponent({ event }) {
  const isBlocked = event.isBlocked;
  const hasNotes  = !!event.resource?.notes;
  const isOnline  = event.resource?.source === 'online_booking';

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '3px',
        overflow:       'hidden',
        width:          '100%',
        fontSize:       '11px',
        fontWeight:     'bold',
        lineHeight:     '1.3',
        direction:      'rtl',
      }}
      title={event.title}
    >
      {/* אייקון הערות תור */}
      {!isBlocked && hasNotes && (
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
            width:          '12px',
            height:         '12px',
            opacity:        0.9,
          }}
          title="יש הערה לתור"
        >
          {/* MessageSquare SVG inline — אין import בקומפוננט קטן */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
               style={{ width: '100%', height: '100%' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      )}

      {/* אייקון הזמנה אונליין */}
      {!isBlocked && isOnline && (
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
            width:          '11px',
            height:         '11px',
            opacity:        0.9,
          }}
          title="תור מהאתר"
        >
          {/* Globe SVG inline */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
               style={{ width: '100%', height: '100%' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </span>
      )}

      {/* כותרת */}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {event.title}
      </span>
    </div>
  );
}

const eventStyleGetter = (event) => {
  const isBlocked = event.isBlocked;
  // ✅ ימים סגורים — אפור כדי להשתלב עם הרקע; חסימות רגילות — כתום
  const backgroundColor = isBlocked
    ? (event.title === 'יום סגור' ? '#9ca3af' : '#f97316')
    : (event.resource?.color || '#e5007e');

  return {
    style: {
      backgroundColor,
      borderRadius: '8px',
      opacity:      event.resource?.status === 'cancelled' ? 0.5 : 0.9,
      color:        'white',
      border:       'none',
      display:      'block',
      fontSize:     '11px',
      fontWeight:   'bold',
      padding:      '2px 5px',
      cursor:       isBlocked ? 'default' : 'pointer',
      textAlign:    'right',
    },
  };
};

const createDate = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes]   = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
};

const MESSAGES = {
  week:             'שבוע',
  day:              'יום',
  month:            'חודש',
  previous:         'הקודם',
  next:             'הבא',
  today:            'היום',
  agenda:           'סדר יום',
  noEventsInRange:  'אין תורים בטווח הזה.',
  showMore:         (count) => `+ עוד ${count}`,
};

const VIEWS = ['month', 'week', 'day'];

// ✅ Fallbacks למקרה שה-props לא הגיעו
const DEFAULT_MIN = new Date(0, 0, 0, 7, 0);
const DEFAULT_MAX = new Date(0, 0, 0, 22, 0);

// ✅ 4. Custom components object — מוגדר מחוץ לקומפוננט למניעת re-render מיותר
const CALENDAR_COMPONENTS = {
  event: CustomEventComponent,
};

export default function CalendarView({
  appointments = [],
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  minTime,
  maxTime,
  businessHours,   // ✅ לצביעת ימים סגורים
  closedDays,      // ✅ לצביעת ימי חופשה
  date,
  onNavigate,
  view,
  onView,
}) {
  const events = useMemo(() => {
    return appointments.map((app) => {
      const clientName    = app.customerName || 'לקוחה';
      const treatmentName = app.title || app.serviceTitle || 'תור';
      const isBlocked     = app.isBlocked === true || app.status === 'blocked';
      const displayTitle  = isBlocked
        ? (app.title || '🔒 זמן חסום')
        : `${clientName} - ${treatmentName}`;

      return {
        id:        app.id,
        title:     displayTitle,
        start:     createDate(app.date, app.startTime),
        end:       createDate(app.date, app.endTime),
        isBlocked,
        resource:  app,
      };
    });
  }, [appointments]);

  const handleSelectEvent = useCallback((event) => {
    if (event.isBlocked) return;
    onSelectEvent?.(event);
  }, [onSelectEvent]);

  const handleSelectSlot = useCallback((slotInfo) => {
    onSelectSlot?.(slotInfo);
  }, [onSelectSlot]);

  // ✅ בדיקה אם יום הוא סגור (לפי הגדרות העסק או יום חופשה)
  const isDayClosed = useCallback((dateObj) => {
    if (!dateObj) return false;
    const cfg = businessHours?.[dateObj.getDay()];
    if (!cfg || !cfg.isActive) return true;
    if (closedDays?.includes(toDateStrLocal(dateObj))) return true;
    return false;
  }, [businessHours, closedDays]);

  // ✅ צביעת רקע עמודות בתצוגת חודש/שבוע
  const customDayPropGetter = useCallback((dateObj) => {
    if (isDayClosed(dateObj)) {
      return { className: '!bg-gray-100 dark:!bg-gray-800/80 cursor-not-allowed' };
    }
    return {};
  }, [isDayClosed]);

  // ✅ צביעת חריצי זמן בתצוגת שבוע/יום
  const customSlotPropGetter = useCallback((dateObj) => {
    if (isDayClosed(dateObj)) {
      return { className: '!bg-gray-100/50 dark:!bg-gray-800/50 cursor-not-allowed' };
    }
    return {};
  }, [isDayClosed]);

  // ✅ 5. גובה מותאם לפי תצוגה — week/day גבוה יותר לחריצים מרווחים
  const calendarHeight = view === 'month' ? 750 : 1400;

  return (
    <div
      className="
        w-full bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm
        border border-gray-100 dark:border-gray-700

        [&_.rbc-header]:bg-gray-50 [&_.rbc-header]:dark:bg-gray-700
        [&_.rbc-header]:text-gray-600 [&_.rbc-header]:dark:text-gray-300
        [&_.rbc-header]:text-xs [&_.rbc-header]:font-bold
        [&_.rbc-header]:py-2 [&_.rbc-header]:border-gray-200 [&_.rbc-header]:dark:border-gray-600

        [&_.rbc-month-view]:border-gray-200 [&_.rbc-month-view]:dark:border-gray-600
        [&_.rbc-day-bg]:dark:bg-gray-800
        [&_.rbc-off-range-bg]:bg-gray-50 [&_.rbc-off-range-bg]:dark:bg-gray-900/40
        [&_.rbc-today]:!bg-pink-50 [&_.rbc-today]:dark:!bg-pink-900/10

        [&_.rbc-time-view]:border-gray-200 [&_.rbc-time-view]:dark:border-gray-600
        [&_.rbc-time-content]:border-gray-200 [&_.rbc-time-content]:dark:border-gray-600
        [&_.rbc-timeslot-group]:border-gray-100 [&_.rbc-timeslot-group]:dark:border-gray-700
        [&_.rbc-time-slot]:text-xs [&_.rbc-time-slot]:text-gray-400 [&_.rbc-time-slot]:dark:text-gray-500
        [&_.rbc-label]:text-xs [&_.rbc-label]:text-gray-400 [&_.rbc-label]:dark:text-gray-500

        [&_.rbc-current-time-indicator]:bg-[#e5007e]

        [&_.rbc-date-cell]:text-xs [&_.rbc-date-cell]:font-semibold
        [&_.rbc-date-cell]:text-gray-500 [&_.rbc-date-cell]:dark:text-gray-400
        [&_.rbc-date-cell.rbc-now_a]:!text-[#e5007e] [&_.rbc-date-cell.rbc-now_a]:!font-bold
      "
      dir="rtl"
      style={{ height: calendarHeight }}
    >
      <DnDCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture="he"
        rtl={true}
        toolbar={false}
        date={date}
        onNavigate={onNavigate}
        view={view}
        onView={onView}
        views={VIEWS}
        selectable={!!onSelectSlot}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        resizable
        dayPropGetter={customDayPropGetter}
        slotPropGetter={customSlotPropGetter}
        step={15}
        timeslots={4}
        min={minTime || DEFAULT_MIN}
        max={maxTime || DEFAULT_MAX}
        eventPropGetter={eventStyleGetter}
        components={CALENDAR_COMPONENTS}
        messages={MESSAGES}
        popup
        popupOffset={10}
      />
    </div>
  );
}