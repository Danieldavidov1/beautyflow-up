// src/App.jsx
import { useState, useEffect } from 'react';
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
import Login from './components/Login';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // ✅ מנגנון מצב לילה (Dark Mode) חכם
  const [isDarkMode, setIsDarkMode] = useState(() => {
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

  // ✅ מאזין למצב ההתחברות של המשתמש
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

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

  // ✅ בזמן טעינה - מציג מסך ריק
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 text-lg">טוען...</p>
      </div>
    );
  }

  // ✅ אם המשתמש לא מחובר - מציג Login
  if (!user) {
    return <Login />;
  }

  // ✅ אם מחובר - מציג האפליקציה הרגילה
  return (
    <AppProvider>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <Header
            setIsOpen={setIsSidebarOpen}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            user={user}
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
