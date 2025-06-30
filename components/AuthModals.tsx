import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { initWalletForUser } from '../lib/wallet';

interface AuthModalsProps {
  isSignInOpen: boolean;
  isSignUpOpen: boolean;
  onCloseSignIn: () => void;
  onCloseSignUp: () => void;
  onSwitchToSignUp: () => void;
}

export default function AuthModals({ 
  isSignInOpen, 
  isSignUpOpen, 
  onCloseSignIn, 
  onCloseSignUp,
  onSwitchToSignUp 
}: AuthModalsProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) return;
      
      const usernameDoc = await getDoc(doc(db, 'usernames', username));
      setUsernameAvailable(!usernameDoc.exists());
    };

    const debounceTimer = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounceTimer);
  }, [username]);

  const ensureAlexEthnicityField = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (!userData.alexEthnicity) {
          // Add the alexEthnicity field with default value
          await setDoc(userRef, {
            alexEthnicity: 'Pride Alex'
          }, { merge: true });
          console.log('Added alexEthnicity field to existing user:', userId);
        }
      }
    } catch (error) {
      console.error('Error ensuring alexEthnicity field:', error);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Initialize wallet on login (for existing users who might not have wallets)
      await initWalletForUser(userCredential.user.uid);
      // Ensure alexEthnicity field exists for existing users
      await ensureAlexEthnicityField(userCredential.user.uid);
      onCloseSignIn();
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameAvailable) {
      setError('Username is not available');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document with alexEthnicity field
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        firstName,
        lastName,
        username,
        email,
        alexEthnicity: 'Pride Alex' // Default value for new users
      });
      
      // Reserve username
      await setDoc(doc(db, 'usernames', username), {
        uid: userCredential.user.uid
      });
      
      // Initialize wallet with 420 seconds (7 minutes) using top-level wallets collection
      await initWalletForUser(userCredential.user.uid);
      
      onCloseSignUp();
    } catch (err) {
      setError('Error creating account');
    }
  };

  return (
    <>
      <Dialog open={isSignInOpen} onClose={onCloseSignIn} className="relative z-50">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4">
          <Dialog.Panel className="bg-gray-900 rounded-lg p-6 sm:p-8 w-full max-w-sm mx-4 border border-gray-700 shadow-xl">
            <Dialog.Title className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white">Sign In</Dialog.Title>
            <form onSubmit={handleSignIn} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm sm:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm sm:text-base"
                  required
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2.5 sm:py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
              >
                Sign In
              </button>
              <p className="text-sm text-center text-gray-300">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToSignUp}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Sign Up here
                </button>
              </p>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      <Dialog open={isSignUpOpen} onClose={onCloseSignUp} className="relative z-50">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4">
          <Dialog.Panel className="bg-gray-900 rounded-lg p-6 sm:p-8 w-full max-w-sm mx-4 border border-gray-700 shadow-xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white">Sign Up</Dialog.Title>
            <form onSubmit={handleSignUp} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm sm:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm sm:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`mt-1 block w-full rounded-md bg-gray-800 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm sm:text-base ${
                    username.length >= 3 && !usernameAvailable ? 'border-red-500' : ''
                  }`}
                  required
                />
                {username.length >= 3 && !usernameAvailable && (
                  <p className="text-red-400 text-sm mt-1">Username is not available</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm sm:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md bg-gray-800 border-gray-600 text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm sm:text-base"
                  required
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2.5 sm:py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
              >
                Sign Up
              </button>
              <div className="text-xs text-gray-400 text-center">
                By signing up, you'll receive 7 minutes of free talk time!
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}