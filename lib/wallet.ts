import { getFirestore, doc, setDoc, getDoc, runTransaction, collection, addDoc, query, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface WalletData {
  balance: number; // in seconds
  lastLoaded: Date;
}

/**
 * Initialize wallet for user with 420 seconds (7 minutes) if it doesn't exist
 * Uses top-level wallets collection: wallets/{userId}
 */
export async function initWalletForUser(userId: string): Promise<void> {
  try {
    const walletRef = doc(db, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);
    
    if (!walletSnap.exists()) {
      await setDoc(walletRef, {
        balance: 420, // 7 minutes in seconds
        lastLoaded: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error initializing wallet:', error);
    throw error;
  }
}

/**
 * Get current wallet balance for user from top-level wallets collection
 */
export async function getWalletBalance(userId: string): Promise<number> {
  try {
    const walletRef = doc(db, 'wallets', userId);
    const walletSnap = await getDoc(walletRef);
    
    if (walletSnap.exists()) {
      return walletSnap.data().balance || 0;
    }
    
    // Initialize wallet if it doesn't exist
    await initWalletForUser(userId);
    return 420; // Default 7 minutes
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return 0;
  }
}

/**
 * Deduct call duration from wallet
 * Uses top-level wallets/{userId}
 */
export async function logCall(userId: string, duration: number): Promise<void> {
  try {
    if (duration <= 0) {
      throw new Error('Call duration must be positive');
    }

    const walletRef = doc(db, 'wallets', userId);
    
    await runTransaction(db, async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      
      if (!walletDoc.exists()) {
        throw new Error(`Wallet missing for user ${userId}!`);
      }
      
      const prevBalance = walletDoc.data().balance || 0;
      const newBalance = Math.max(prevBalance - duration, 0);
      
      // Update wallet balance
      transaction.update(walletRef, { balance: newBalance });
    });
  } catch (error) {
    console.error('Error logging call:', error);
    throw error;
  }
}

/**
 * Add minutes to wallet
 * Uses top-level wallets/{userId}
 */
export async function loadMinutes(userId: string, minutes: number): Promise<void> {
  try {
    if (minutes <= 0) {
      throw new Error('Minutes must be positive');
    }

    const walletRef = doc(db, 'wallets', userId);
    
    await runTransaction(db, async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      const prevBalance = walletDoc.exists() ? walletDoc.data().balance || 0 : 0;
      const secondsToAdd = minutes * 60;
      const newBalance = prevBalance + secondsToAdd;
      
      // Update wallet balance and lastLoaded
      if (walletDoc.exists()) {
        transaction.update(walletRef, { 
          balance: newBalance, 
          lastLoaded: serverTimestamp() 
        });
      } else {
        transaction.set(walletRef, {
          balance: newBalance,
          lastLoaded: serverTimestamp()
        });
      }
    });
  } catch (error) {
    console.error('Error loading minutes:', error);
    throw error;
  }
}

/**
 * Format seconds to MM:SS format
 */
export function formatSecondsToMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Check if user has sufficient balance for a call
 */
export async function hasInsufficientBalance(userId: string, requiredSeconds: number = 30): Promise<boolean> {
  const balance = await getWalletBalance(userId);
  return balance < requiredSeconds;
}