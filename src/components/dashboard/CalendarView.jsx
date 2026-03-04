// src/components/dashboard/CalendarView.jsx
import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// ── Helpers ────────────────────────────────────────────────────────────────
const toDateStrLocal = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const slotKey = (dateObj) => {
  const date = toDateStrLocal(dateObj);
  const hh   = String(dateObj.getHours()).padStart(2, '0');
  const mm   = String(dateObj.getMinutes()).padStart(2, '0');
  return `${date}|${hh}:${mm}`;
};

const timeFromKey = (key) => key?.split('|')[1] ?? '';

const locales        = { he };
const startOfWeekFn  = (date) => startOfWeek(date, { weekStartsOn: 0 });
const localizer      = dateFnsLocalizer({ format, parse, startOfWeek: startOfWeekFn, getDay, locales });

const withDnD      = typeof withDragAndDrop === 'function' ? withDragAndDrop : withDragAndDrop.default;
const DnDCalendar  = withDnD(Calendar);

// ── Custom Event Component ─────────────────────────────────────────────────
function CustomEventComponent({ event }) {
  const isBlocked = event.isBlocked;
  const hasNotes  = !!event.resource?.notes;
  const isOnline  = event.resource?.source === 'online_booking';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '3px',
        overflow: 'hidden', width: '100%',
        fontSize: '11px', fontWeight: 'bold', lineHeight: '1.3', direction: 'rtl',
      }}
      title={event.title}
    >
      {!isBlocked && hasNotes && (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                       flexShrink:0, width:'12px', height:'12px', opacity:0.9 }}
              title="יש הערה לתור">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
               style={{ width:'100%', height:'100%' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      )}
      {!isBlocked && isOnline && (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                       flexShrink:0, width:'11px', height:'11px', opacity:0.9 }}
              title="תור מהאתר">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
               style={{ width:'100%', height:'100%' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </span>
      )}
      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
        {event.title}
      </span>
    </div>
  );
}

// ── eventStyleGetter ───────────────────────────────────────────────────────
const eventStyleGetter = (event) => {
  const isBlocked = event.isBlocked;
  let backgroundColor;
  if (isBlocked) {
    backgroundColor = event.title === 'יום סגור' ? '#9ca3af' : '#f97316';
  } else if (event.resource?.status === 'completed') {
    backgroundColor = '#10b981';
  } else {
    backgroundColor = event.resource?.color || '#e5007e';
  }
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

// ── Helpers ────────────────────────────────────────────────────────────────
const createDate = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes]   = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
};

const MESSAGES = {
  week: 'שבוע', day: 'יום', month: 'חודש',
  previous: 'הקודם', next: 'הבא', today: 'היום',
  agenda: 'סדר יום', noEventsInRange: 'אין תורים בטווח הזה.',
  showMore: (count) => `+ עוד ${count}`,
};

const VIEWS       = ['month', 'week', 'day'];
const DEFAULT_MIN = new Date(0, 0, 0, 7,  0);
const DEFAULT_MAX = new Date(0, 0, 0, 22, 0);
const CALENDAR_COMPONENTS = { event: CustomEventComponent };

// ── SlotWrapper ────────────────────────────────────────────────────────────
function makeSlotWrapper(pendingSlot) {
  return function SlotWrapper({ children, value }) {
    if (!value) return children;

    const key            = slotKey(value);
    const time           = timeFromKey(key);
    const isPendingExact = pendingSlot === key;

    if (!isPendingExact) return children;

    return React.cloneElement(children, {
      className: `${children.props.className || ''} rbc-slot-pending`.trim(),
      style: { ...children.props.style, position: 'relative', overflow: 'visible' },
      children: (
        <>
          {children.props.children ?? null}
          <div className="custom-pending-tooltip">
            {time} | לחצי שוב לקביעה ✓
            <div className="tooltip-arrow" />
          </div>
        </>
      )
    });
  };
}

// ── CalendarView ───────────────────────────────────────────────────────────
export default function CalendarView({
  appointments = [],
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  minTime,
  maxTime,
  businessHours,
  closedDays,
  date,
  onNavigate,
  view,
  onView,
}) {
  const [pendingSlot, setPendingSlot] = useState(null);
  const clearTimerRef                 = useRef(null);

  useEffect(() => { setPendingSlot(null); }, [view, date]);
  useEffect(() => () => clearTimeout(clearTimerRef.current), []);

  const calendarComponents = useMemo(() => ({
    ...CALENDAR_COMPONENTS,
    timeSlotWrapper: makeSlotWrapper(pendingSlot),
  }), [pendingSlot]);

  const events = useMemo(() => appointments.map((app) => {
    const clientName    = app.customerName || 'לקוחה';
    const treatmentName = app.title || app.serviceTitle || 'תור';
    const isBlocked     = app.isBlocked === true || app.status === 'blocked';
    const displayTitle  = isBlocked
      ? (app.title || '🔒 זמן חסום')
      : `${clientName} - ${treatmentName}`;
    return {
      id: app.id, title: displayTitle,
      start: createDate(app.date, app.startTime),
      end:   createDate(app.date, app.endTime),
      isBlocked, resource: app,
    };
  }), [appointments]);

  const handleSelectEvent = useCallback((event) => {
    if (event.isBlocked) return;
    setPendingSlot(null);
    clearTimeout(clearTimerRef.current);
    onSelectEvent?.(event);
  }, [onSelectEvent]);

  const handleSelectSlot = useCallback((slotInfo) => {
    if (view === 'month') {
      onSelectSlot?.(slotInfo);
      return;
    }

    clearTimeout(clearTimerRef.current);

    if (slotInfo.action === 'select') return;

    const key = slotKey(slotInfo.start);

    if (pendingSlot === key) {
      setPendingSlot(null);
      onSelectSlot?.({
        ...slotInfo,
        end: new Date(slotInfo.start.getTime() + 15 * 60000),
      });
    } else {
      setPendingSlot(key);
      clearTimerRef.current = setTimeout(() => setPendingSlot(null), 4000);
    }
  }, [view, pendingSlot, onSelectSlot]);

  const isDayClosed = useCallback((dateObj) => {
    if (!dateObj) return false;
    const cfg = businessHours?.[dateObj.getDay()];
    if (!cfg || !cfg.isActive) return true;
    if (closedDays?.includes(toDateStrLocal(dateObj))) return true;
    return false;
  }, [businessHours, closedDays]);

  const customDayPropGetter = useCallback((dateObj) => {
    if (isDayClosed(dateObj))
      return { className: '!bg-gray-100 dark:!bg-gray-800/80 cursor-not-allowed' };
    return {};
  }, [isDayClosed]);

  const customSlotPropGetter = useCallback((dateObj) => {
    if (isDayClosed(dateObj))
      return { className: '!bg-gray-100/50 dark:!bg-gray-800/50 cursor-not-allowed' };
    return {};
  }, [isDayClosed]);

  const calendarHeight = view === 'month' ? 750 : 1400;

  return (
    <div
      className="
        w-full bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm
        border border-gray-100 dark:border-gray-700 relative

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
      <style>{`
        /* 1. מונע מהשכבה השקופה לחסום לחיצות */
        .rbc-events-container { pointer-events: none !important; }
        .rbc-event { pointer-events: auto !important; }

        /* 2. hover — מחשב בלבד */
        .rbc-time-slot { transition: background-color 0.15s ease; }
        @media (hover: hover) {
          .rbc-day-slot .rbc-time-slot:not(.cursor-not-allowed):not(.rbc-slot-pending):hover {
            background-color: rgba(229, 0, 126, 0.08) !important;
          }
        }

        /* 3. משבצת pending */
        .rbc-slot-pending {
          background-color: rgba(229, 0, 126, 0.12) !important;
          box-shadow: inset 0 0 0 2px rgba(229, 0, 126, 0.7) !important;
          cursor: pointer !important;
          z-index: 50;
        }
        @keyframes slotPulse {
          0%, 100% { box-shadow: inset 0 0 0 2px rgba(229,0,126,0.5); }
          50%      { box-shadow: inset 0 0 0 2px rgba(229,0,126,1);   }
        }
        .rbc-slot-pending { animation: slotPulse 1.4s ease-in-out infinite; }

        /* 4. בועית */
        .custom-pending-tooltip {
          position: absolute;
          bottom: calc(100% + 4px);
          right: 50%;
          transform: translateX(50%);
          background: #e5007e;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 9999;
          direction: rtl;
          box-shadow: 0 2px 10px rgba(229,0,126,0.35);
          line-height: 1.5;
        }
        .tooltip-arrow {
          position: absolute;
          top: 100%;
          right: 50%;
          transform: translateX(50%);
          width: 0; height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 5px solid #e5007e;
        }

        /* 5. מסתיר בועית בציר הזמן */
        .rbc-time-gutter .custom-pending-tooltip { display: none !important; }

        /* 6. מסתיר ריבוע גרירה כחול */
        .rbc-slot-selection { display: none !important; pointer-events: none !important; }

        /* 7. hover חודש */
        .rbc-day-bg:not(.cursor-not-allowed) { transition: background-color 0.15s ease; }
        .rbc-day-bg:not(.cursor-not-allowed):hover {
          background-color: rgba(229, 0, 126, 0.08) !important;
        }

        /* 8. overflow לבועית */
        .rbc-time-slot { overflow: visible !important; }
        .rbc-timeslot-group { overflow: visible !important; }
        .rbc-time-content { overflow-x: hidden !important; }
      `}</style>

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
        onSelecting={() => false}
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
        components={calendarComponents}
        messages={MESSAGES}
        popup
        popupOffset={10}
      />
    </div>
  );
}
