import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

export const requestForToken = async () => {
  const messagingSupported = await isSupported();
  if (!messagingSupported) return null;
  
  const messaging = getMessaging(app);
  try {
    const currentToken = await getToken(messaging, { 
      // vapidKey: 'YOUR_VAPID_KEY_HERE_FROM_FIREBASE_CONSOLE' 
    });
    
    if (currentToken) {
      return currentToken;
      // Send the token to your server and update the user's profile to allow them to receive notifications
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = async () => {
    const messagingSupported = await isSupported();
    if (!messagingSupported) return new Promise((resolve) => resolve(null));

    const messaging = getMessaging(app);
    return new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
};

export default app;
