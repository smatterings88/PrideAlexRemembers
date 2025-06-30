'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initWalletForUser, getWalletBalance } from '../../lib/wallet';
import WalletDisplay from '../../components/WalletDisplay';
import UserDropdown from '../../components/UserDropdown';
import { ArrowLeft, Settings, Globe, Bell, Shield } from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [alexEthnicity, setAlexEthnicity] = useState<string>('Pride Alex');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Initialize wallet when user loads dashboard
        await initWalletForUser(currentUser.uid);
        // Get current balance
        const balance = await getWalletBalance(currentUser.uid);
        setWalletBalance(balance);
        
        // Load user's alexEthnicity preference
        await loadUserPreferences(currentUser.uid);
      } else {
        router.push('/');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserPreferences = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setAlexEthnicity(userData.alexEthnicity || 'Pride Alex');
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const handleBalanceUpdate = (balance: number) => {
    setWalletBalance(balance);
  };

  const handleRefresh = () => {
    // Refresh wallet balance
    if (user) {
      getWalletBalance(user.uid).then(setWalletBalance);
    }
  };

  const handleBackToHome = () => {
    // Use window.location for a full page navigation to ensure it works
    window.location.href = '/';
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        alexEthnicity: alexEthnicity
      }, { merge: true });
      
      setSaveMessage('Preferences saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveMessage('Error saving preferences. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A2647] via-[#144272] to-[#205295] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2647] via-[#144272] to-[#205295]">
      {/* Header */}
      <header className="bg-black/10 backdrop-blur-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToHome}
                className="p-2 text-white hover:text-blue-200 transition-colors rounded-full hover:bg-white/10"
                title="Back to Home"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img 
                src="https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/6862391e5cf8a548ab7a0741.png" 
                alt="VoiceAI Logo" 
                className="h-12"
              />
              <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            </div>
            <UserDropdown user={user} onRefresh={handleRefresh} />
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Wallet Display */}
          <div className="lg:col-span-1 min-h-[320px] flex">
            <WalletDisplay 
              userId={user.uid} 
              onBalanceUpdate={handleBalanceUpdate}
            />
          </div>

          {/* Account Overview */}
          <div className="lg:col-span-1 min-h-[320px] flex">
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full flex flex-col">
              <h2 className="text-2xl font-bold text-[#0A2647] mb-6">Account Overview</h2>
              
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Email</span>
                  <span className="text-gray-600">{user.email}</span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Account Status</span>
                  <span className="text-green-600 font-semibold">Active</span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Current Balance</span>
                  <span className="text-[#2C74B3] font-bold">
                    {Math.floor(walletBalance / 60)}:{(walletBalance % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Quick Action Button */}
                <div className="mt-auto pt-4">
                  <button
                    onClick={handleBackToHome}
                    className="w-full bg-[#2C74B3] text-white py-3 px-4 rounded-lg hover:bg-[#205295] transition-colors font-medium"
                  >
                    Start New Call
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Preferences Section */}
        <div className="mt-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Settings className="w-6 h-6 text-[#2C74B3]" />
              <h2 className="text-2xl font-bold text-[#0A2647]">Account Preferences</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Ethnicity Preference */}
              <div className="p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3 mb-4">
                  <Globe className="w-5 h-5 text-[#2C74B3]" />
                  <h3 className="text-lg font-semibold text-gray-800">Voice Assistant</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">Your AI conversation partner</p>
                <select 
                  value={alexEthnicity}
                  onChange={(e) => setAlexEthnicity(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2C74B3] focus:border-transparent text-gray-800 bg-white"
                >
                  <option value="Pride Alex">Pride Alex</option>
                </select>
              </div>

              {/* Notification Settings */}
              <div className="p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3 mb-4">
                  <Bell className="w-5 h-5 text-[#2C74B3]" />
                  <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">Manage your notification preferences</p>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded text-[#2C74B3] focus:ring-[#2C74B3] opacity-50 cursor-not-allowed" defaultChecked disabled />
                    <span className="text-sm text-gray-500">Low balance alerts</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded text-[#2C74B3] focus:ring-[#2C74B3] opacity-50 cursor-not-allowed" disabled />
                    <span className="text-sm text-gray-500">Weekly summaries</span>
                  </label>
                </div>
              </div>

              {/* Privacy Settings */}
              <div className="p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3 mb-4">
                  <Shield className="w-5 h-5 text-[#2C74B3]" />
                  <h3 className="text-lg font-semibold text-gray-800">Privacy</h3>
                </div>
                <p className="text-gray-600 text-sm mb-4">Control your data and privacy settings</p>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded text-[#2C74B3] focus:ring-[#2C74B3] opacity-50 cursor-not-allowed" defaultChecked disabled />
                    <span className="text-sm text-gray-500">Save conversation history</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded text-[#2C74B3] focus:ring-[#2C74B3] opacity-50 cursor-not-allowed" defaultChecked disabled />
                    <span className="text-sm text-gray-500">Improve AI responses</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Save Button and Message */}
            <div className="mt-8 flex justify-end items-center space-x-4">
              {saveMessage && (
                <span className={`text-sm font-medium ${
                  saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'
                }`}>
                  {saveMessage}
                </span>
              )}
              <button 
                onClick={handleSavePreferences}
                disabled={isSaving}
                className="bg-[#2C74B3] text-white px-6 py-3 rounded-lg hover:bg-[#205295] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}