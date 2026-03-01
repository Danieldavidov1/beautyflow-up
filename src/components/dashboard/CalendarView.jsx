// src/components/dashboard/CalendarView.jsx
import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// ── הגדרת שפה לעברית ──────────────────────────────────────────────────────────
const locales = { he };

const startOfWeekFn = (date) => startOfWeek(date, { weekStartsOn: 0 });

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: startOfWeekFn,
  getDay,
  locales,
});

// שעות תחילה וסיום קבועות — נוצרות פעם אחת, לא בכל render
const MIN_TIME = new Date(0, 0, 0, 7, 0);
const MAX_TIME = new Date(0, 0, 0, 22, 0);

// פונקציית עזר להמרת "YYYY-MM-DD" ו-"HH:MM" לאובייקט Date
const createDate = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
};

// עיצוב ויזואלי — מוגדר מחוץ לקומפוננט למניעת re-creation
const eventStyleGetter = (event) => ({
  style: {
    backgroundColor: event.isBlocked ? '#EF4444' : '#e5007e',
    borderRadius: '8px',
    opacity: 0.9,
    color: 'white',
    border: 'none',
    display: 'block',
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '2px 5px',
  },
});

const MESSAGES = {
  week: 'שבוע',
  work_week: 'שבוע עבודה',
  day: 'יום',
  month: 'חודש',
  previous: 'הקודם',
  next: 'הבא',
  today: 'היום',
  agenda: 'סדר יום',
  noEventsInRange: 'אין תורים בטווח הזה.',
};

export default function CalendarView({ 
  appointments = [], 
  onSelectEvent,
  date,          // ✅ הוסף לשליטה בתאריך
  onNavigate,    // ✅ הוסף לניווט תאריכים
  view,          // ✅ הוסף לשליטה בסוג התצוגה
  onView         // ✅ הוסף למעבר בין תצוגות
}) {

  const events = useMemo(() => {
    return appointments.map((app) => ({
      id: app.id,
      title: app.isBlocked
        ? (app.title || 'חסום')
        : (app.customerName || app.serviceTitle || 'תור'),
      start: createDate(app.date, app.startTime),
      end: createDate(app.date, app.endTime),
      isBlocked: app.isBlocked === true || app.status === 'blocked',
      resource: app,
    }));
  }, [appointments]);

  return (
    <div
      // ✅ הוספנו עיצוב Tailwind עוטף כדי לצבוע את הכפתורים בוורוד
      className="h-[700px] w-full bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm 
                 [&_.rbc-toolbar]:mb-4 [&_.rbc-btn-group_button]:!border-[#e5007e] [&_.rbc-btn-group_button]:!text-[#e5007e] [&_.rbc-active]:!bg-[#e5007e] [&_.rbc-active]:!text-white [&_.rbc-today]:!bg-pink-50"
      dir="rtl"
    >
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture="he"
        rtl={true}
        date={date}             // ✅ מקבל תאריך מבחוץ
        onNavigate={onNavigate} // ✅ מעדכן תאריך מבחוץ (כפתורי הבא/קודם)
        view={view}             // ✅ מקבל תצוגה מבחוץ (חודש/שבוע)
        onView={onView}         // ✅ מעדכן תצוגה מבחוץ
        views={['month', 'week', 'day']}
        step={15}
        timeslots={4}
        min={MIN_TIME}
        max={MAX_TIME}
        eventPropGetter={eventStyleGetter}
        messages={MESSAGES}
        onSelectEvent={onSelectEvent} 
      />
    </div>
  );
}