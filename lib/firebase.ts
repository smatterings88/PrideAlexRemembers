import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Validate Firebase configuration
const validateConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
  
  if (missingFields.length > 0) {
    console.error('Missing Firebase configuration fields:', missingFields);
    throw new Error(`Missing Firebase configuration: ${missingFields.join(', ')}`);
  }
};

console.log('Initializing Firebase with config:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasProjectId: !!firebaseConfig.projectId,
  hasAuthDomain: !!firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId // Show actual project ID for debugging
});

// Validate configuration before initializing
validateConfig();

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with improved settings
export const db = getFirestore(app);

// Enable network connectivity and handle connection issues
let isNetworkEnabled = true;

export const ensureFirestoreConnection = async () => {
  try {
    if (!isNetworkEnabled) {
      await enableNetwork(db);
      isNetworkEnabled = true;
      console.log('Firestore network re-enabled');
    }
  } catch (error) {
    console.error('Failed to enable Firestore network:', error);
    throw error;
  }
};

// Handle network state changes
export const handleNetworkError = async (error: any) => {
  if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
    console.warn('Firestore connection unavailable, attempting to reconnect...');
    try {
      await ensureFirestoreConnection();
    } catch (reconnectError) {
      console.error('Failed to reconnect to Firestore:', reconnectError);
    }
  }
};

// Export a helper function to check if we're online
export const isFirestoreOnline = () => isNetworkEnabled;