import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';


// תחליף את הערכים האלה בפרטים מ-Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCzJKoKKTq0ATP_6eg5eX3sW9lK3tI4BDE",
  authDomain: "kibutzsystem.firebaseapp.com",
  projectId: "kibutzsystem",
  storageBucket: "kibutzsystem.firebasestorage.app",
  messagingSenderId: "1024082104379",
  appId: "1:1024082104379:web:b8b13dfb0de13b7807cc1e"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth and db
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;