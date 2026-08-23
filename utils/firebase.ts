import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <-- Idagdag ito para sa database/chat
import { getAuth } from "firebase/auth";           // <-- Idagdag ito kung gagamitin din ang Firebase Auth

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCKnF-j0JhI5zOq03FY5tma-xId6YSywcc",
  authDomain: "diskartech-2bf71.firebaseapp.com",
  projectId: "diskartech-2bf71",
  storageBucket: "diskartech-2bf71.firebasestorage.app",
  messagingSenderId: "408355828373",
  appId: "1:408355828373:web:e7282d58b06b58e2d7a19c",
  measurementId: "G-1X8NTJB56N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);   // <-- Ito ang gagamitin natin para sa real-time chat messages
// export const auth = getAuth(app); // <-- Ito ang gagamitin para sa authentication (optional)