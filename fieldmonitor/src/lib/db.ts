import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { firebaseConfig, firebaseConfigMissing } from './firebase';

export const db = firebaseConfigMissing ? null : getDatabase(initializeApp(firebaseConfig));
