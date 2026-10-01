import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, getFirestore, Firestore } from "firebase/firestore";

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

// Initialize Firebase (safely handling Fast Refresh)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;