import { createContext, useContext, useState, useCallback } from 'react';
// אנחנו מייבאים את הטוסט שיצרת מהתיקייה של ה-layout
import Toast from '../components/layout/Toast';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  // פונקציה להצגת הודעה - זמינה לכל האפליקציה
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // פונקציה להסתרת ההודעה
  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* כאן ה-Toast יושב ומחכה להודעות מעל כל האפליקציה */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
}

// זה ה"הוק" (Hook) שנשתמש בו בדפים כדי להקפיץ הודעות
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}