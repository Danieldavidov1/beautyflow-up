// src/components/layout/Sidebar.jsx
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, TrendingUp, TrendingDown, Target,
  Calculator, BarChart3, Settings, X, CheckSquare,
  MessageCircle, Users, Calendar as CalendarIcon, Tag, Inbox,
} from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const menuItems = [
  { icon: LayoutDashboard, label: 'מסך הבית',        path: 'dashboard'  },
  { icon: CalendarIcon,    label: 'יומן תורים',      path: 'calendar'   },
  { icon: Users,           label: 'לקוחות',           path: 'customers'  },
  { icon: Tag,             label: 'שירותים ומחירון', path: 'services'   },
  { icon: Inbox,           label: 'בקשות תורים',     path: 'requests'   }, // ✅ חדש
  { icon: TrendingUp,      label: 'הכנסות',           path: 'income'     },
  { icon: TrendingDown,    label: 'הוצאות',           path: 'expenses'   },
  { icon: Calculator,      label: 'תקציב',            path: 'budget'     },
  { icon: BarChart3,       label: 'דוחות',            path: 'reports'    },
  { icon: Target,          label: 'יעדים',            path: 'goals'      },
  { icon: CheckSquare,     label: 'משימות',           path: 'tasks'      },
  { icon: MessageCircle,   label: 'תבניות הודעות',    path: 'templates'  },
  { icon: Settings,        label: 'הגדרות',           path: 'settings'   },
];

export default function Sidebar({
  currentPage    = 'dashboard',
  setCurrentPage = () => {},
  isOpen         = false,
  setIsOpen      = () => {},
  customerCount  = 0,
}) {
  const [pendingCount, setPendingCount] = useState(0);

  // ── האזנה בזמן אמת לבקשות ממתינות ──────────────────────────────
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'bookingRequests'),
      where('ownerUid', '==', auth.currentUser.uid),
      where('status',   '==', 'pending'),
    );

    // onSnapshot — מתעדכן אוטומטית כשמגיעה בקשה חדשה
    const unsub = onSnapshot(q, (snap) => {
      setPendingCount(snap.size);
    }, (err) => {
      console.error('[Sidebar] pendingCount:', err);
    });

    return () => unsub(); // ✅ ניקוי listener בעת unmount
  }, []);

  const handleClick = (path) => {
    if (typeof setCurrentPage === 'function') setCurrentPage(path);
    setIsOpen(false);
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-30 transition-opacity"
        />
      )}

      <aside
        className={`
          fixed right-0 top-[73px] h-[calc(100vh-73px)] w-64
          bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700
          p-4 z-40 transition-all duration-300 ease-in-out
          overflow-y-auto flex flex-col justify-between
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          md:translate-x-0
        `}
      >
        <div>
          {/* כפתור סגירה במובייל */}
          <div className="md:hidden flex justify-between items-center mb-4 pb-3
                          border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">תפריט</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700
                         rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <nav className="space-y-1 pb-6">
            {menuItems.map((item) => {
              const isActive = currentPage === item.path;

              // ── badge לפי סוג כפתור ──────────────────────────
              const badge = (() => {
                if (item.path === 'customers' && customerCount > 0)
                  return { count: customerCount, urgent: false };
                if (item.path === 'requests' && pendingCount > 0)
                  return { count: pendingCount, urgent: true };
                return null;
              })();

              return (
                <button
                  key={item.path}
                  onClick={() => handleClick(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl
                    transition-colors relative
                    ${isActive
                      ? 'bg-[#e5007e] text-white shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="font-medium flex-1 text-right">{item.label}</span>

                  {badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                      min-w-[20px] text-center transition-all
                      ${isActive
                        ? 'bg-white/30 text-white'
                        : badge.urgent
                          ? 'bg-red-500 text-white animate-pulse'   // 🔴 בקשות — דחוף
                          : 'bg-[#e5007e]/10 text-[#e5007e]'        // לקוחות — רגיל
                      }`}>
                      {badge.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Banner שדרוג */}
        <div className="mt-auto p-4 bg-gradient-to-br from-[#e5007e]/10 to-[#ff4da6]/10
          dark:from-[#e5007e]/20 dark:to-[#ff4da6]/20 rounded-xl
          border border-[#e5007e]/20 dark:border-[#e5007e]/30">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            משקיעה בעצמך 💅
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            שדרגי ל-Pro וקבלי כלים מתקדמים
          </p>
          <button className="w-full bg-[#e5007e] text-white text-sm py-2 px-4
            rounded-lg hover:bg-[#b30062] transition-colors font-medium">
            שדרגי עכשיו
          </button>
        </div>
      </aside>
    </>
  );
}
