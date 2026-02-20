import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAromVDlsteeFL7WUv_BL2wrCxPIOj04z0",
  authDomain: "beauty-finance-up.firebaseapp.com",
  projectId: "beauty-finance-up",
  storageBucket: "beauty-finance-up.firebasestorage.app",
  messagingSenderId: "990026246828",
  appId: "1:990026246828:web:6dcd098ab0c5dd662e8d09"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
