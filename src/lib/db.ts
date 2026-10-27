import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { firebaseConfig, firebaseConfigMissing } from './firebase';

export const db = firebaseConfigMissing
  ? null
  : getDatabase(getApps().length ? getApps()[0] : initializeApp(firebaseConfig));
