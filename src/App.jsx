// src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider }       from './context/AppContext';
import { ToastProvider }     from './context/ToastContext';
import Header                from './components/layout/Header';
import Sidebar               from './components/layout/Sidebar';
import Dashboard             from './components/dashboard/Dashboard';
import Income                from './components/dashboard/Income';
import Expenses              from './components/dashboard/Expenses';
import Budget                from './components/dashboard/Budget';
import Reports               from './components/dashboard/Reports';
import Goals                 from './components/dashboard/Goals';
import Tasks                 from './components/dashboard/Tasks';
import SmartTemplates        from './components/dashboard/SmartTemplates';
import Settings              from './components/dashboard/Settings';
import Customers             from './components/dashboard/Customers';
import Calendar              from './components/dashboard/Calendar';
import Services              from './components/dashboard/Services';
import BookingRequests       from './components/dashboard/BookingRequests'; // ✅ חדש
import BookingPage           from './components/BookingPage';
import Login                 from './components/Login';
import { auth }              from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useCustomers }      from './hooks/useCustomers';

// ── AppShell ──────────────────────────────────────────────────────────────────

function AppShell({ user, isDarkMode, toggleDarkMode }) {
  const [currentPage,   setCurrentPage]  = useState('requests');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [navContext,    setNavContext]    = useState(null);

  const { customers } = useCustomers();

  const navigateTo = (page, context = null) => {
    setNavContext(context);
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard currentPage={currentPage} setCurrentPage={navigateTo} />;
      case 'calendar':  return <Calendar />;
      case 'customers': return <Customers prefilledContact={navContext} />;
      case 'services':  return <Services />;
      case 'income':    return <Income />;
      case 'expenses':  return <Expenses />;
      case 'budget':    return <Budget />;
      case 'reports':   return <Reports />;
      case 'goals':     return <Goals />;
      case 'tasks':     return <Tasks />;
      case 'templates': return <SmartTemplates prefilledContact={navContext} />;
      case 'settings':  return <Settings />;
      case 'requests':  return <BookingRequests />; // ✅ חדש
      default:          return <Dashboard currentPage={currentPage} setCurrentPage={navigateTo} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Header
        setIsOpen={setIsSidebarOpen}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        user={user}
      />
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={navigateTo}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        customerCount={customers.length}
      />
      <main className="mr-0 md:mr-64 pt-[73px]">
        {renderPage()}
      </main>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [user,        setUser]        = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return unsub;
  }, []);

  const toggleDarkMode = () => setIsDarkMode((p) => !p);

  if (loadingAuth) return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#e5007e]
                        border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">טוען...</p>
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* ✅ דף ציבורי — ללא auth */}
          <Route path="/book/:providerId" element={<BookingPage />} />

          {/* ✅ כל שאר הנתיבים — דורשים התחברות */}
          <Route path="/*" element={
            !user ? (
              <Login />
            ) : (
              <AppProvider>
                <AppShell
                  user={user}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                />
              </AppProvider>
            )
          } />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
