import { useEffect, useState } from 'react';
import { getWalletBalance, formatSecondsToMinutes } from '../lib/wallet';
import { Wallet, RefreshCw } from 'lucide-react';

interface WalletDisplayProps {
  userId: string;
  onBalanceUpdate?: (balance: number) => void;
}

export default function WalletDisplay({ userId, onBalanceUpdate }: WalletDisplayProps) {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBalance = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const currentBalance = await getWalletBalance(userId);
      setBalance(currentBalance);
      if (onBalanceUpdate) {
        onBalanceUpdate(currentBalance);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchBalance();
    }
  }, [userId]);

  const handleRefresh = () => {
    fetchBalance(true);
  };

  const handleChoosePlan = () => {
    window.open('https://alexlistens.com/pricing', '_blank');
  };

  const getBalanceColor = () => {
    if (balance <= 60) return 'text-red-600'; // 1 minute or less
    if (balance <= 300) return 'text-yellow-600'; // 5 minutes or less
    return 'text-green-600';
  };

  const getBalanceBackground = () => {
    if (balance <= 60) return 'bg-red-50 border-red-200';
    if (balance <= 300) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 w-full">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-200 animate-pulse rounded-full"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-200 animate-pulse rounded w-32 mb-2"></div>
            <div className="h-8 bg-gray-200 animate-pulse rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl shadow-xl p-6 sm:p-8 border-2 w-full flex flex-col ${getBalanceBackground()}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white rounded-full shadow-sm">
            <Wallet className="w-6 h-6 text-[#2C74B3]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Call Wallet</h3>
            <p className="text-sm text-gray-500">Available talk time</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-full hover:bg-white/50"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mb-6 flex-1">
        <div className={`text-3xl font-bold ${getBalanceColor()}`}>
          {formatSecondsToMinutes(balance)}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {balance <= 60 ? 'Low balance - consider adding more time' :
           balance <= 300 ? 'Running low on time' :
           'Good balance'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 mb-3">Alex Listens Plans:</p>
        <button
          onClick={handleChoosePlan}
          className="w-full flex items-center justify-center px-4 py-3 bg-[#2C74B3] text-white rounded-lg hover:bg-[#205295] transition-colors text-sm font-medium"
        >
          Choose Your Perfect Plan
        </button>
      </div>

      {balance <= 60 && (
        <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-medium">
            ⚠️ Low Balance Warning
          </p>
          <p className="text-red-700 text-xs mt-1">
            You have less than 1 minute remaining. Add more time to continue using AlexListens.
          </p>
        </div>
      )}
    </div>
  );
}