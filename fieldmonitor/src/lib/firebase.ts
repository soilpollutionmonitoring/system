// Public Firebase web configuration. These values are safe to expose in a
// client bundle — access control is enforced by database.rules.json, not secrecy.
// Fill in .env (see .env.example) with the values from your Firebase console.
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
  databaseURL:
    (env.VITE_FIREBASE_DATABASE_URL as string) ||
    'https://soilpollution1-3c0d4-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string) || 'soilpollution1-3c0d4',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: env.VITE_FIREBASE_APP_ID as string,
};

export const firebaseConfigMissing =
  !firebaseConfig.apiKey || !firebaseConfig.projectId;
