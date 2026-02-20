import { useState, useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose && onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  return (
    // השינוי כאן: bottom-4 left-4 במקום top-4 right-4
    <div className={`fixed bottom-4 left-4 z-50 p-4 rounded-xl shadow-2xl animate-slide-in ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'warning' ? 'bg-orange-500 text-white' :
      'bg-gray-500 text-white'
    }`}>
      {message}
    </div>
  );
}