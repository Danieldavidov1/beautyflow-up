// src/App.jsx
import { useState, useEffect } from 'react'; // ✅ הוספנו useEffect
import { AppProvider } from './context/AppContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import Income from './components/dashboard/Income';
import Expenses from './components/dashboard/Expenses';
import Budget from './components/dashboard/Budget';
import Reports from './components/dashboard/Reports';
import Goals from './components/dashboard/Goals';
import Settings from './components/dashboard/Settings';
import { ToastProvider } from './context/ToastContext';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ✅ מנגנון מצב לילה (Dark Mode) חכם
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // בודק אם יש שמירה בזיכרון, ואם לא - בודק מה מוגדר במחשב של המשתמש
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) return JSON.parse(savedMode);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // ✅ מחיל את מחלקת ה-'dark' על האתר כולו ושומר בזיכרון
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard currentPage={currentPage} />;
      case 'income':
        return <Income />;
      case 'expenses':
        return <Expenses />;
      case 'budget':
        return <Budget />;
      case 'reports':
        return <Reports />;
      case 'goals':
        return <Goals />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard currentPage={currentPage} />;
    }
  };

  return (
    <AppProvider>
      <ToastProvider>
        {/* ✅ הוספנו רקע כהה (dark:bg-gray-900) ועידון מעבר צבעים */}
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <Header 
            setIsOpen={setIsSidebarOpen} 
            isDarkMode={isDarkMode} 
            toggleDarkMode={toggleDarkMode} 
          />
          <Sidebar
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
          />
          <main className="mr-0 md:mr-64 pt-[73px]">
            {renderPage()}
          </main>
        </div>
      </ToastProvider>
    </AppProvider>
  );
}

export default App;