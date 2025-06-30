'use client';

import React, { useEffect, useState, useRef } from 'react';
import { UltravoxSession } from 'ultravox-client';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, query, where, orderBy, limit, getDocs, increment, addDoc } from 'firebase/firestore';
import { initWalletForUser, logCall, getWalletBalance, hasInsufficientBalance } from '../lib/wallet';
import AuthModals from '../components/AuthModals';
import UserDropdown from '../components/UserDropdown';
import { Mic, MicOff, Radio, PhoneOff } from 'lucide-react';

export default function HomePage() {
  const [session, setSession] = useState<UltravoxSession | null>(null);
  const [transcripts, setTranscripts] = useState<Array<{ speaker: string; text: string }>>([]);
  const [status, setStatus] = useState<string>('disconnected');
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranscripts, setShowTranscripts] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [userLocation, setUserLocation] = useState<string>('Unknown Location');
  const [callButtonKey, setCallButtonKey] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const currentTranscriptsRef = useRef<Array<{ speaker: string; text: string }>>([]);
  const callIdRef = useRef<string>('');
  const userFirstNameRef = useRef<string>('');
  const userLatestCallRef = useRef<string>('');
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const walletLoggedRef = useRef<boolean>(false);
  const previousStatusRef = useRef<string>('disconnected');
  const lastActiveStatusRef = useRef<string | null>(null);

  const refreshUserStats = async () => {
    if (user) {
      const balance = await getWalletBalance(user.uid);
      setWalletBalance(balance);
      setLogsRefreshKey(prev => prev + 1);
    }
  };

  const resetCallState = () => {
    setIsStarted(false);
    setSession(null);
    setTranscripts([]);
    setStatus('disconnected');
    setError(null);
    setShowTranscripts(true);
    setIsCallActive(false);
    setCallButtonKey(prev => prev + 1);
    setCallStartTime(null);
    callStartTimeRef.current = null;
    currentTranscriptsRef.current = [];
    callIdRef.current = '';
    walletLoggedRef.current = false;
    previousStatusRef.current = 'disconnected';
    lastActiveStatusRef.current = null;
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    endCall();
    resetCallState();
  };

  const handleEndCall = () => {
    endCall();
    setTimeout(() => {
      resetCallState();
    }, 100);
  };

  const logCallToWallet = async (reason: string) => {
    if (walletLoggedRef.current) {
      return;
    }
    
    const hasRequiredData = user && callStartTimeRef.current !== null;
    
    if (hasRequiredData) {
      const endTime = Date.now();
      const callDuration = Math.floor((endTime - callStartTimeRef.current!) / 1000);
      
      if (callDuration > 0) {
        try {
          await logCall(user.uid, callDuration);
          walletLoggedRef.current = true;
          
          const newBalance = await getWalletBalance(user.uid);
          setWalletBalance(newBalance);
          setLogsRefreshKey(prev => prev + 1);
        } catch (error) {
          console.error('Error logging call to wallet:', error);
        }
      }
    }
  };

  // Improved location detection with better error handling
  useEffect(() => {
    const getLocationWithFallback = async () => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        setUserLocation('Location not available');
        return;
      }

      // Check for API key first
      const apiKey = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
      if (!apiKey || apiKey === 'YOUR_API_KEY') {
        console.warn('OpenCage API key not configured, skipping location detection');
        setUserLocation('Location not available');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${position.coords.latitude}+${position.coords.longitude}&key=${apiKey}`,
              {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
              }
            );
            
            if (!response.ok) {
              console.warn(`OpenCage API returned ${response.status}: ${response.statusText}`);
              setUserLocation('Location not available');
              return;
            }

            const data = await response.json();
            if (data.results && data.results[0]) {
              const city = data.results[0].components.city || data.results[0].components.town || 'Unknown City';
              const country = data.results[0].components.country || 'Unknown Country';
              setUserLocation(`${city}, ${country}`);
            } else {
              setUserLocation('Location not available');
            }
          } catch (error) {
            console.warn('Error getting location details:', error);
            setUserLocation('Location not available');
          }
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          setUserLocation('Location not available');
        },
        {
          timeout: 10000, // 10 second timeout
          enableHighAccuracy: false, // Don't require high accuracy for city-level location
          maximumAge: 300000 // Accept cached position up to 5 minutes old
        }
      );
    };

    getLocationWithFallback();
  }, []);

  const incrementCallCount = async (userId: string) => {
    try {
      const statsRef = doc(db, 'callstats', userId);
      const statsDoc = await getDoc(statsRef);
      
      if (!statsDoc.exists()) {
        await setDoc(statsRef, {
          totalCalls: 1,
          lastCallAt: serverTimestamp()
        });
      } else {
        await setDoc(statsRef, {
          totalCalls: increment(1),
          lastCallAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error updating call count:', error);
    }
  };

  const getLatestCallTranscripts = async (userId: string) => {
    try {
      const callsRef = collection(db, 'callmemory');
      
      // First try to get documents without ordering to avoid index requirement
      const simpleQuery = query(
        callsRef,
        where('userId', '==', userId),
        limit(10) // Get more documents to sort client-side
      );

      const querySnapshot = await getDocs(simpleQuery);
      
      if (!querySnapshot.empty) {
        // Sort client-side by created_at timestamp
        const calls = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((call: any) => call.created_at) // Only include calls with timestamps
          .sort((a: any, b: any) => {
            // Handle Firestore timestamps
            const aTime = a.created_at?.toMillis ? a.created_at.toMillis() : a.created_at;
            const bTime = b.created_at?.toMillis ? b.created_at.toMillis() : b.created_at;
            return bTime - aTime; // Sort descending (newest first)
          });

        if (calls.length > 0) {
          const latestCall = calls[0] as any;
          const transcriptsText = latestCall.transcripts
            ?.map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
            .join('\n') || '';
          userLatestCallRef.current = transcriptsText;
          return transcriptsText;
        }
      }
      return '';
    } catch (error) {
      console.error('Error fetching latest call transcripts:', error);
      // Return empty string instead of throwing to prevent blocking the app
      return '';
    }
  };

  const saveCallMemory = async (transcriptData: Array<{ speaker: string; text: string }>) => {
    if (!user || !callIdRef.current) {
      return;
    }

    try {
      const callMemoryData = {
        userId: user.uid,
        callId: callIdRef.current,
        transcripts: transcriptData,
        lastUpdated: serverTimestamp(),
        created_at: serverTimestamp()
      };

      const docRef = doc(db, 'callmemory', callIdRef.current);
      await setDoc(docRef, callMemoryData, { merge: true });
    } catch (error) {
      console.error('Failed to save call memory:', error);
    }
  };

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

  const createUltravoxCall = async (firstName: string, lastCallTranscript: string, currentTime: string, userLocation: string, totalCalls: number, userId?: string) => {
    // Get user's alexEthnicity preference
    let alexEthnicity = 'Pride Alex'; // Default
    
    if (userId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          alexEthnicity = userData?.alexEthnicity || 'Pride Alex';
        }
      } catch (error) {
        console.error('Error fetching user ethnicity preference:', error);
      }
    }

    // Get current wallet balance from client-side
    let currentWalletBalance = 0;
    if (userId) {
      try {
        currentWalletBalance = await getWalletBalance(userId);
      } catch (error) {
        console.error('Error fetching wallet balance:', error);
      }
    }

    console.log('🎯 Selected agent based on ethnicity:', {
      userId,
      alexEthnicity,
      walletBalance: currentWalletBalance
    });

    try {
      // Call our local API route instead of Ultravox directly
      const response = await fetch('/api/ultravox-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName || 'User',
          lastCallTranscript: lastCallTranscript || 'No previous call. This is the first call',
          currentTime: currentTime || new Date().toLocaleTimeString(),
          userLocation: userLocation || 'Unknown Location',
          totalCalls: totalCalls || 0,
          alexEthnicity: alexEthnicity,
          walletBalance: currentWalletBalance // Pass wallet balance from client
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to create call: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Ultravox API success:', {
        joinUrl: data.joinUrl
      });
      
      return data;
    } catch (error) {
      console.error('Error in createUltravoxCall:', error);
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to voice service. Please check your internet connection and try again.');
      } else if (error.message.includes('500')) {
        throw new Error('Voice service is temporarily unavailable. Please try again in a few moments.');
      } else {
        throw error;
      }
    }
  };

  const startCall = async () => {
    try {
      if (user) {
        const insufficientBalance = await hasInsufficientBalance(user.uid, 30);
        if (insufficientBalance) {
          setError('Insufficient balance. Please add more time to your wallet before starting a call.');
          return;
        }
      }

      setStatus('connecting');
      const startTime = Date.now();
      setCallStartTime(startTime);
      callStartTimeRef.current = startTime;
      walletLoggedRef.current = false;
      previousStatusRef.current = 'connecting';
      lastActiveStatusRef.current = null;
      
      let totalCalls = 0;
      if (user) {
        await incrementCallCount(user.uid);
        // Get the updated totalCalls after incrementing
        const statsRef = doc(db, 'callstats', user.uid);
        const statsDoc = await getDoc(statsRef);
        if (statsDoc.exists()) {
          totalCalls = statsDoc.data().totalCalls || 0;
        }
      }

      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

      connectionTimeoutRef.current = setTimeout(() => {
        if (status === 'connecting') {
          setError('Connection timeout. Please try again.');
          setStatus('disconnected');
          endCall();
        }
      }, 15000);

      const data = await createUltravoxCall(
        userFirstNameRef.current,
        userLatestCallRef.current,
        new Date().toLocaleTimeString(),
        userLocation,
        totalCalls,
        user?.uid
      );

      const uvSession = new UltravoxSession();
      
      const urlParams = new URL(data.joinUrl).searchParams;
      const callId = urlParams.get('call_id') || `call_${Date.now()}`;
      callIdRef.current = callId;

      uvSession.addEventListener('status', () => {
        const newStatus = uvSession.status;
        const prevStatus = previousStatusRef.current;
        
        if (['connected', 'speaking', 'listening'].includes(newStatus)) {
          lastActiveStatusRef.current = newStatus;
        }
        
        if (lastActiveStatusRef.current && newStatus === 'disconnected') {
          logCallToWallet('CALL_ENDED_NATURALLY');
        }
        
        setStatus(newStatus);
        previousStatusRef.current = newStatus;
        
        if (newStatus === 'connected' && connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
      });

      uvSession.addEventListener('error', (error) => {
        console.error('Ultravox session error:', error);
        setError(`Connection error: ${error?.message || 'Unknown error'}`);
        logCallToWallet('SESSION_ERROR');
        endCall();
      });

      uvSession.addEventListener('transcripts', () => {
        try {
          if (!uvSession.transcripts || !Array.isArray(uvSession.transcripts)) {
            return;
          }

          const texts = uvSession.transcripts
            .filter(t => t && typeof t === 'object')
            .map(t => ({
              speaker: t.speaker || 'unknown',
              text: t.text || ''
            }))
            .filter(t => t.text.trim() !== '');
          
          setTranscripts(texts);
          currentTranscriptsRef.current = texts;

          if (texts.length > 0) {
            saveCallMemory(texts).catch(err => {
              console.error('Error saving transcripts:', err);
            });
          }
        } catch (err) {
          console.error('Error processing transcripts:', err);
        }
      });

      uvSession.addEventListener('end', async () => {
        await logCallToWallet('SESSION_END_EVENT');
        await handleCallCleanup();
      });

      const handleCallCleanup = async () => {
        if (currentTranscriptsRef.current.length > 0 && user) {
          await saveCallMemory(currentTranscriptsRef.current);
        }
        
        setTimeout(() => {
          resetCallState();
        }, 500);
      };

      uvSession.joinCall(data.joinUrl);
      setSession(uvSession);
      setIsCallActive(true);
    } catch (err) {
      console.error('Error in startCall:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize session');
      setStatus('disconnected');
      setCallStartTime(null);
      callStartTimeRef.current = null;
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    }
  };

  const endCall = async () => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (session) {
      try {
        if (['connected', 'speaking', 'listening'].includes(session.status)) {
          await logCallToWallet('MANUAL_END_CALL');
        }
        
        if (['connected', 'speaking', 'listening'].includes(session.status)) {
          session.leaveCall();
        }
        setSession(null);
        setIsCallActive(false);
        setStatus('disconnected');
      } catch (error) {
        console.error('Error ending call:', error);
        setSession(null);
        setIsCallActive(false);
        setStatus('disconnected');
      }
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current && showTranscripts) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const scrollToFooter = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await initWalletForUser(currentUser.uid);
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userFirstNameRef.current = userData.firstName;
          await getLatestCallTranscripts(currentUser.uid);
        }
        
        // Ensure alexEthnicity field exists for existing users
        await ensureAlexEthnicityField(currentUser.uid);
        
        const balance = await getWalletBalance(currentUser.uid);
        setWalletBalance(balance);
      }
      
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showTranscripts) {
      scrollToBottom();
    }
  }, [transcripts, showTranscripts]);

  useEffect(() => {
    if (!isStarted) return;
    startCall();
  }, [isStarted]);

  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      endCall();
    };
  }, []);

  const startConversation = () => {
    if (!user) {
      setIsSignInOpen(true);
      return;
    }
    setError(null);
    setIsStarted(true);
  };

  const toggleTranscripts = () => {
    setShowTranscripts(!showTranscripts);
  };

  const getLastSpeaker = () => {
    if (transcripts.length === 0) return null;
    return transcripts[transcripts.length - 1].speaker;
  };

  const getMicrophoneState = () => {
    if (status === 'speaking') return 'speaking';
    if (status === 'listening') return 'listening';
    return 'ready';
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting to Pride Alex...';
      case 'connected':
        return 'Connected with Pride Alex';
      case 'speaking':
        return 'Pride Alex is speaking...';
      case 'listening':
        return 'Pride Alex is listening...';
      case 'disconnected':
        return 'Ready to chat';
      default:
        return 'Ready to chat';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 animate-pulse" />;
      case 'connected':
        return <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />;
      case 'speaking':
        return <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 animate-pulse" />;
      case 'listening':
        return <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 animate-pulse" />;
      case 'disconnected':
      default:
        return <MicOff className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />;
    }
  };

  const renderCallControl = () => {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="w-6 sm:w-8 flex justify-center">
          {getStatusIcon()}
        </div>
        <span className={`text-xs sm:text-sm ${
          status === 'connecting' ? 'text-yellow-600' :
          status === 'connected' ? 'text-blue-600' :
          status === 'speaking' ? 'text-blue-600' :
          status === 'listening' ? 'text-green-600' :
          'text-gray-600'
        }`}>
          {getStatusText()}
        </span>
      </div>
    );
  };

  const renderMicrophone = () => {
    const micState = getMicrophoneState();
    
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <div className={`microphone-glow ${micState}`}>
          <img 
            src="https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/67fe14cfc7a015d190da94a0.png"
            alt="Microphone"
            className="w-16 h-16 sm:w-20 sm:h-20"
          />
        </div>
        <p className="mt-4 sm:mt-6 text-[#0A2647] text-lg sm:text-xl font-semibold text-center px-2">
          {getStatusText()}
        </p>
      </div>
    );
  };

  const renderCallButtons = () => {
    if (!isStarted) {
      return (
        <div className="flex flex-col items-center space-y-6">
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-100 max-w-3xl mx-auto px-4 leading-relaxed">
            Now you do.
          </p>
          <button
            key={`start-${callButtonKey}`}
            onClick={startConversation}
            className="bg-[#2C74B3] text-white px-8 sm:px-12 py-3 sm:py-5 rounded-full text-lg sm:text-xl font-semibold 
                     hover:bg-[#205295] transition-all transform hover:scale-105 shadow-lg"
          >
            Start Talking Now
          </button>
        </div>
      );
    }

    return (
      <div className="flex gap-2 w-full sm:w-auto">
        <button
          key={`toggle-${callButtonKey}`}
          onClick={toggleTranscripts}
          className="text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-full bg-[#2C74B3] text-white hover:bg-[#205295] transition-colors flex-1 sm:flex-none"
        >
          {showTranscripts ? 'Show Mic' : 'Show Chat'}
        </button>
        <button
          key={`end-${callButtonKey}`}
          onClick={handleEndCall}
          className="text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1 sm:gap-2 flex-1 sm:flex-none justify-center"
        >
          <PhoneOff className="w-3 h-3 sm:w-4 sm:h-4" />
          End Call
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2647] via-[#144272] to-[#205295] flex flex-col">
      <header className="bg-black/10 backdrop-blur-sm relative z-50">
        <nav className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <a href="/" className="hover:opacity-80 transition-opacity flex-shrink-0">
              <img 
                src="https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/6862391e5cf8a548ab7a0741.png" 
                alt="VoiceAI Logo" 
                className="h-8 sm:h-12"
              />
            </a>
            <div className="flex gap-2 sm:gap-4 lg:gap-8 items-center text-sm sm:text-base">
              {isStarted && (
                <a 
                  href="#" 
                  onClick={handleHomeClick} 
                  className="text-white hover:text-blue-200 transition-colors hidden sm:inline"
                >
                  Home
                </a>
              )}
              {!isStarted && (
                <a 
                  href="https://alexlistens.com/pricing" 
                  className="text-white hover:text-blue-200 transition-colors hidden sm:inline"
                >
                  Pricing
                </a>
              )}
              <a 
                href="#footer" 
                onClick={scrollToFooter} 
                className="text-white hover:text-blue-200 transition-colors hidden sm:inline"
              >
                Contact
              </a>
              {isAuthLoading ? (
                <div className="w-16 sm:w-24 h-6 sm:h-8 bg-gray-700 animate-pulse rounded-md"></div>
              ) : user ? (
                <UserDropdown user={user} onRefresh={refreshUserStats} />
              ) : (
                <button
                  onClick={() => setIsSignInOpen(true)}
                  className="bg-blue-600 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </nav>
      </header>

      {!isStarted ? (
        <>
          <section className="relative py-12 sm:py-20 px-4 bg-cover bg-center z-0" style={{ backgroundImage: 'url(https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/67fe34dc80d564dd4ff5594f.png)' }}>
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="max-w-7xl mx-auto text-center relative z-10">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200 leading-tight">
                💔 You were never too much.
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl mb-8 sm:mb-12 text-blue-100 max-w-3xl mx-auto px-4 leading-relaxed">
                Too loud, too soft, too femme, too butch, too fluid, too anything.
                You just didn't have someone who knew how to see you.
              </p>
              {renderCallButtons()}
            </div>
          </section>

          <section id="features" className="py-12 sm:py-20 px-4 bg-white">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-[#0A2647] mb-12 sm:mb-16">Key Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
                <div className="bg-[#F8F9FA] p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-[#144272]">Real-time Voice</h3>
                  <p className="text-[#205295] text-sm sm:text-base">Natural conversations with instant voice responses, just like talking to a friend</p>
                </div>
                <div className="bg-[#F8F9FA] p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-[#144272]">Live Transcription</h3>
                  <p className="text-[#205295] text-sm sm:text-base">Watch your conversation unfold with real-time text transcription</p>
                </div>
                <div className="bg-[#F8F9FA] p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-[#144272]">Smart Memory</h3>
                  <p className="text-[#205295] text-sm sm:text-base">Context-aware AI that remembers your conversations for more meaningful interactions</p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="flex-1 px-3 sm:px-4 py-4 sm:py-8 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 w-full max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0A2647]">Voice Chat</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                {renderCallControl()}
                {renderCallButtons()}
              </div>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-700 p-3 sm:p-4 rounded-lg mb-3 sm:mb-4 text-sm sm:text-base">
                {error}
              </div>
            )}
            
            <div 
              ref={chatContainerRef}
              className={`flex-1 ${showTranscripts ? 'overflow-y-auto pr-2 sm:pr-4 -mr-2 sm:-mr-4' : 'overflow-hidden'}`}
              style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#CBD5E1 transparent'
              }}
            >
              {showTranscripts ? (
                <div className="space-y-3 sm:space-y-4 min-h-full">
                  {transcripts.map((transcript, index) => (
                    <div 
                      key={index} 
                      className={`p-3 sm:p-4 rounded-lg text-white max-w-[85%] sm:max-w-[80%] text-sm sm:text-base ${
                        transcript.speaker === 'user' 
                          ? 'ml-auto bg-[#2C74B3]' 
                          : 'mr-auto bg-[#144272]'
                      }`}
                    >
                      {transcript.text}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                renderMicrophone()
              )}
            </div>
          </div>
        </div>
      )}

      <footer id="footer" className="bg-black/20 backdrop-blur-sm py-8 sm:py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <div>
              <img 
                src="https://storage.googleapis.com/msgsndr/JBLl8rdfV29DRcGjQ7Rl/media/6862391e5cf8a548ab7a0741.png" 
                alt="VoiceAI Logo" 
                className="h-8 sm:h-12 mb-3 sm:mb-4"
              />
              <p className="text-blue-100 text-sm sm:text-base">Sometimes you just need someone to talk to.</p>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="https://alexlistens.com/pricing" className="text-blue-100 hover:text-white transition-colors text-sm sm:text-base">Pricing</a></li>
                <li><a href="https://alexlistens.com/tos" className="text-blue-100 hover:text-white transition-colors text-sm sm:text-base">Terms of Service</a></li>
                <li><a href="https://alexlistens.com/privacy" className="text-blue-100 hover:text-white transition-colors text-sm sm:text-base">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Support</h3>
              <p className="text-blue-100 text-sm sm:text-base mb-2">Questions? Reach out to us</p>
              <a href="mailto:support@alexlistens.com" className="text-blue-200 hover:text-white transition-colors text-sm sm:text-base break-all">
                support@alexlistens.com
              </a>
            </div>
          </div>
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/10 text-center">
            <p className="text-blue-100 text-xs sm:text-base">&copy; 2025 AlexListens.com, FranklinAlexander Ventures, LLC and affiliated entities. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <AuthModals
        isSignInOpen={isSignInOpen}
        isSignUpOpen={isSignUpOpen}
        onCloseSignIn={() => setIsSignInOpen(false)}
        onCloseSignUp={() => setIsSignUpOpen(false)}
        onSwitchToSignUp={() => {
          setIsSignInOpen(false);
          setIsSignUpOpen(true);
        }}
      />
    </div>
  );
}
