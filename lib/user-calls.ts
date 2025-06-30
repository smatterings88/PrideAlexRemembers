import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/** Returns the stored totalCalls for this user (0 if none) */
export async function fetchTotalCalls(userId: string): Promise<number> {
  try {
    const statsRef = doc(db, 'callstats', userId);
    const statsDoc = await getDoc(statsRef);
    if (statsDoc.exists()) {
      const data = statsDoc.data();
      return data.totalCalls || 0;
    }
    return 0;
  } catch (e) {
    console.error('Error fetching totalCalls:', e);
    return 0;
  }
}