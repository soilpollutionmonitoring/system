// Public Firebase web configuration. These values are safe to expose in a
// client bundle — access control is enforced by database.rules.json, not secrecy.
// Fill in .env (see .env.example) with the values from your Firebase console.
// Never print or commit the values; only the names of missing variables are reported.

const env = import.meta.env as Record<string, string | undefined>;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

const REQUIRED_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/** Names of required env variables that are missing (names only — never values). */
export function missingFirebaseVars(): string[] {
  return REQUIRED_VARS.filter((v) => !env[v]);
}

export const firebaseConfigMissing = missingFirebaseVars().length > 0;
