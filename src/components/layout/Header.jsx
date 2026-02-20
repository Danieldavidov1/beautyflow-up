import { Bell, User, Menu, Moon, Sun } from 'lucide-react'; // ✅ הוספנו אייקוני לילה/יום

// ✅ הוספנו את הפרופס של מצב הלילה
export default function Header({ setIsOpen, isDarkMode, toggleDarkMode }) { 
  return (
    // ✅ הוספנו תמיכה בצבעי לילה (dark:bg-gray-800, dark:border-gray-700)
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 sticky top-0 z-50 transition-colors duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(prev => !prev)}
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </button>
          
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e5007e] to-[#ff4da6] flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
            Beauty Flow <span className="text-[#e5007e]">UP</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          
          {/* ✅ כפתור החלפת מצב לילה/יום */}
          <button 
            onClick={toggleDarkMode}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-300"
            title={isDarkMode ? 'עבור למצב יום' : 'עבור למצב לילה'}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>

          <button className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-200" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#e5007e] rounded-full border-2 border-white dark:border-gray-800"></span>
          </button>
          
          <div className="hidden sm:flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">נטלי קוסמטיקס</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">קליניקת יופי</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#e5007e]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[#e5007e]" />
            </div>
          </div>
          
          <div className="sm:hidden w-9 h-9 rounded-full bg-[#e5007e]/10 flex items-center justify-center">
            <User className="w-5 h-5 text-[#e5007e]" />
          </div>
        </div>
      </div>
    </header>
  );
}