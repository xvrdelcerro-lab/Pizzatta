// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // Import Firestore

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDFHHUmaqMXpCgbIS9vMGByVyB8LrWT7q4",
  authDomain: "pizzatta-ccded.firebaseapp.com",
  projectId: "pizzatta-ccded",
  storageBucket: "pizzatta-ccded.firebasestorage.app",
  messagingSenderId: "162482603131",
  appId: "1:162482603131:web:692f76e2b9bd2406e54ede",
  measurementId: "G-19KEJFGCXF"
};

// Initialize Firebase (ensuring it only initializes once)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics and Firestore
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);

export { app, db, analytics };