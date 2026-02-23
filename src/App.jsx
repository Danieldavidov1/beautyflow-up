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
import Tasks from './components/dashboard/Tasks';
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

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) return JSON.parse(savedMode);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

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
        return <Dashboard currentPage={currentPage} setCurrentPage={setCurrentPage} />;
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
      case 'tasks':
        return <Tasks />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard currentPage={currentPage} setCurrentPage={setCurrentPage} />;
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#e5007e] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      {!user ? (
        <Login />
      ) : (
        <AppProvider>
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
        </AppProvider>
      )}
    </ToastProvider>
  );
}

export default App;