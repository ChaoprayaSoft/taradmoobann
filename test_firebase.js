const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

try {
  console.log("PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  console.log("CLIENT_EMAIL:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  console.log("PRIVATE_KEY exists:", !!process.env.GOOGLE_PRIVATE_KEY);
  
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
  const db = getFirestore();
  console.log("Firebase Admin initialized successfully.");
} catch (error) {
  console.error("Initialization error:", error);
}
