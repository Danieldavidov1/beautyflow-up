import { Bell, Menu, Moon, Sun, LogOut } from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';

export default function Header({ setIsOpen, isDarkMode, toggleDarkMode, user }) {

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("שגיאה ביציאה:", error);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 md:px-8 py-4 sticky top-0 z-50 transition-colors duration-300">
      <div className="flex items-center justify-between">
        
        {/* צד ימין במסך (לוגו ותפריט) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsOpen(prev => !prev)}
            className="md:hidden p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </button>
          
          <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-gradient-to-br from-[#e5007e] to-[#ff4da6] flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-base sm:text-lg">B</span>
          </div>
          {/* הוספנו dir="ltr" כדי להכריח את האנגלית להסתדר משמאל לימין */}
          <h1 dir="ltr" className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300 whitespace-nowrap flex items-baseline gap-1">
            Beauty Flow <span className="text-[#e5007e]">UP</span>
          </h1>
        </div>

        {/* צד שמאל במסך (כלים + משתמש) */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">

          {/* כפתור Dark Mode */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-300 shrink-0"
            title={isDarkMode ? 'עבור למצב יום' : 'עבור למצב לילה'}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* פעמון התראות */}
          <button className="relative p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0">
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-200" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#e5007e] rounded-full border-2 border-white dark:border-gray-800"></span>
          </button>

          {/* פרטי משתמש - Desktop */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors max-w-[180px] lg:max-w-xs">
            <div className="text-right overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.displayName || 'משתמש'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email || ''}
              </p>
            </div>
            {/* תמונת פרופיל Google */}
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="פרופיל"
                className="w-9 h-9 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#e5007e]/10 flex items-center justify-center shrink-0">
                <span className="text-[#e5007e] font-bold text-sm">
                  {user?.displayName?.[0] || 'U'}
                </span>
              </div>
            )}
          </div>

          {/* תמונת פרופיל - Mobile */}
          <div className="sm:hidden shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="פרופיל"
                className="w-8 h-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#e5007e]/10 flex items-center justify-center">
                <span className="text-[#e5007e] font-bold text-sm">
                  {user?.displayName?.[0] || 'U'}
                </span>
              </div>
            )}
          </div>

          {/* כפתור Logout */}
          <button
            onClick={handleLogout}
            className="p-1.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors group shrink-0"
            title="התנתק"
          >
            <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
          </button>

        </div>
      </div>
    </header>
  );
}