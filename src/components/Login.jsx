import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../firebase";

export default function Login() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("שגיאה בהתחברות:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-100 flex items-center justify-center" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        
        {/* אייקון / לוגו */}
        <div className="text-5xl">🔒</div>

        {/* כותרת */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Beauty Finance Up</h1>
          <p className="text-gray-500 mt-1 text-sm">מערכת ניהול פיננסי לעסק</p>
        </div>

        {/* קו מפריד */}
        <div className="w-full border-t border-gray-100" />

        {/* כפתור Google */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          התחבר עם Google
        </button>

        <p className="text-xs text-gray-400 text-center">
          גישה מורשית בלבד
        </p>
      </div>
    </div>
  );
}
