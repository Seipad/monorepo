'use client';

import { useReadContract, useAccount, usePublicClient } from 'wagmi';
import { useState, useEffect, useRef } from 'react';
import { parseEther, formatEther } from 'viem';
import { useRouter } from 'next/navigation';
import PoolManagerABI from '../contracts/abis/PoolManager.json';
import PoolABI from '../contracts/abis/Pool.json';
import { CONTRACTS } from '../contracts/addresses';

interface PresaleData {
  token: string;
  presaleRate: string; // Changed from bigint to string
  softcap: string; // Changed from bigint to string
  hardcap: string; // Changed from bigint to string
  liquidityRate: string; // Changed from bigint to string
  listingRate: string; // Changed from bigint to string
  startTime: string; // Changed from bigint to string
  endTime: string; // Changed from bigint to string
  refund: boolean;
  tokenName: string;
  tokenSymbol: string;
  poolAddress: string;
  progress: number;
  status: 'Live' | 'Coming Soon' | 'Ended' | 'Finalized';
  totalContributed: string; // Add this field
  isFinalized?: boolean; // Add this field
}

type FilterStatus = 'All' | 'Live' | 'Coming Soon' | 'Ended' | 'Finalized';
type SortOrder = 'asc' | 'desc';

export default function HomeForm() {
  const [presales, setPresales] = useState<PresaleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTokenAddress, setNewTokenAddress] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false); // Add this line
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const { address } = useAccount();
  const router = useRouter();
  const publicClient = usePublicClient();
  const previousPresaleCount = useRef(0);
  const eventListener = useRef<any>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Add this useEffect to handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Token Image Component
  const TokenImage = ({ poolAddress }: { poolAddress: string }) => {
    const [imageUrl, setImageUrl] = useState<string>('');

    useEffect(() => {
      const fetchImage = async () => {
        try {
          console.log('🔍 TokenImage: Fetching image for pool address:', poolAddress);

          // First try to get from API
          const apiUrl = `/api/token-metadata?address=${poolAddress}`;
          console.log('📡 Making request to:', apiUrl);

          const response = await fetch(apiUrl);
          console.log('📡 Response status:', response.status);
          console.log('📡 Response ok:', response.ok);

          if (response.ok) {
            const metadata = await response.json();
            console.log('📦 Metadata received for', poolAddress, ':', metadata);
            if (metadata.imageUrl) {
              console.log('✅ Setting image URL:', metadata.imageUrl);
              setImageUrl(metadata.imageUrl);
              return;
            } else {
              console.log('⚠️ No imageUrl in metadata');
            }
          } else {
            const errorText = await response.text();
            console.log('❌ Error response for', poolAddress, ':', response.status, errorText);
          }

          // Fallback: Check localStorage for client-side stored metadata
          const localStorageKey = `token_metadata_${poolAddress}`;
          const localMetadata = localStorage.getItem(localStorageKey);
          if (localMetadata) {
            const parsed = JSON.parse(localMetadata);
            console.log('📱 Found in localStorage:', parsed);
            if (parsed.imageUrl) {
              setImageUrl(parsed.imageUrl);
              return;
            }
          }

          console.log('🟡 No image found for', poolAddress, '- will show default star');
        } catch (error) {
          console.error('Failed to fetch token image for', poolAddress, ':', error);
        }
      };

      if (poolAddress) {
        fetchImage();
      }
    }, [poolAddress]);

    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt="Token logo"
          className="w-8 h-8 rounded-full object-cover border border-gray-200"
        />
      );
    }

    // Fallback to red star ball
    return (
      <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold border border-primary/30">
        ⭐
      </div>
    );
  };

  // Fetch all presale addresses
  const {
    data: presaleAddresses,
    isLoading: addressesLoading,
    error: contractError,
  } = useReadContract({
    address: CONTRACTS.POOL_MANAGER,
    abi: PoolManagerABI,
    functionName: 'getAllPresales',
  });

  // Fetch presale data for each address
  const fetchPresaleData = async (addresses: string[]) => {
    if (!addresses || addresses.length === 0) {
      setPresales([]);
      setLoading(false);
      return;
    }

    const presaleDataPromises = addresses.map(async (poolAddress) => {
      try {
        const response = await fetch(`/api/presale-data?address=${poolAddress}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const presaleData = await response.json();

        if (presaleData.error) {
          throw new Error(presaleData.error);
        }

        const now = Math.floor(Date.now() / 1000);
        const startTime = Number(presaleData.startTime);
        const endTime = Number(presaleData.endTime);
        const isFinalized = presaleData.isFinalized || false;

        let status: 'Live' | 'Coming Soon' | 'Ended' | 'Finalized' = 'Coming Soon';
        if (isFinalized) {
          status = 'Finalized';
        } else if (now >= startTime && now <= endTime) {
          status = 'Live';
        } else if (now > endTime) {
          status = 'Ended';
        }

        // Calculate progress based on actual contributions
        const totalContributed = BigInt(presaleData.totalContributed || '0');
        const softcap = BigInt(presaleData.softcap);
        const progress = Math.min(Math.max(0, Number((totalContributed * 100n) / softcap)), 100);

        return {
          ...presaleData,
          poolAddress,
          progress,
          status,
          totalContributed: presaleData.totalContributed || '0',
        };
      } catch (error) {
        console.error(`Error fetching presale data for ${poolAddress}:`, error);
        return null;
      }
    });

    const results = await Promise.all(presaleDataPromises);
    const validPresales = results.filter(Boolean) as PresaleData[];
    setPresales(validPresales);
    setLoading(false);
  };

  // Check for new presales by comparing array lengths
  const checkForNewPresales = async () => {
    try {
      // Get all presale addresses directly from blockchain
      const allPresales = await publicClient.readContract({
        address: CONTRACTS.POOL_MANAGER,
        abi: PoolManagerABI,
        functionName: 'getAllPresales',
      });

      const currentCount = allPresales?.length || 0;
      console.log(
        ` Blockchain check - Previous: ${previousPresaleCount.current}, Current: ${currentCount}`,
      );

      if (currentCount > previousPresaleCount.current) {
        console.log(
          ` NEW PRESALE DETECTED! Previous: ${previousPresaleCount.current}, Current: ${currentCount}`,
        );

        console.log('📋 All presales from blockchain:', allPresales);

        // Fetch data for the new presales
        if (allPresales && allPresales.length > 0) {
          await fetchPresaleData(allPresales);

          // Find the newest presale and mark it as new
          const newestPresale = presales[presales.length - 1];
          if (newestPresale) {
            console.log('🎯 Marking newest presale as new:', newestPresale.poolAddress);
            setNewTokenAddress(newestPresale.poolAddress);

            // Clear the new token indicator after 3 seconds
            setTimeout(() => setNewTokenAddress(null), 3000);
          }
        }

        previousPresaleCount.current = currentCount;
      }
    } catch (error) {
      console.error('❌ Error checking for new presales:', error);
    }
  };

  // Setup event listener for real-time updates
  useEffect(() => {
    if (!publicClient || !CONTRACTS.POOL_MANAGER) return;

    const setupEventListener = async () => {
      try {
        console.log('Setting up event listener for PresaleCreated...');

        const unwatch = await publicClient.watchContractEvent({
          address: CONTRACTS.POOL_MANAGER,
          abi: PoolManagerABI,
          eventName: 'PresaleCreated',
          onLogs: (logs) => {
            console.log('PresaleCreated event detected:', logs);
            if (logs && logs.length > 0) {
              const newPresaleAddress = logs[0].args.presaleAddress;
              console.log('New presale address from event:', newPresaleAddress);

              // Trigger a check for new presales
              setTimeout(() => {
                checkForNewPresales();
              }, 500); // Wait 0.5 seconds for blockchain to update
            }
          },
          onError: (error) => {
            console.error('Error watching presale events:', error);
          },
        });

        eventListener.current = unwatch;
        console.log('Event listener setup complete');
      } catch (error) {
        console.error('Error setting up event listener:', error);
      }
    };

    setupEventListener();

    return () => {
      if (eventListener.current) {
        eventListener.current();
      }
    };
  }, [publicClient, CONTRACTS.POOL_MANAGER]);

  // Update previous count when presaleAddresses changes
  useEffect(() => {
    if (presaleAddresses) {
      previousPresaleCount.current = presaleAddresses.length;
    }
  }, [presaleAddresses]);

  useEffect(() => {
    if (presaleAddresses) {
      fetchPresaleData(presaleAddresses);
    } else if (!addressesLoading && !contractError) {
      setPresales([]);
      setLoading(false);
    }
  }, [presaleAddresses, addressesLoading, contractError]);

  // Only poll if there are no presales yet
  useEffect(() => {
    const startPolling = () => {
      console.log('🚀 Starting aggressive polling every 0.5 seconds...');
      pollingInterval.current = setInterval(() => {
        console.log('⏰ Polling for new presales...');
        checkForNewPresales();
      }, 5000); // Check every 5 seconds instead
    };

    if (presales.length === 0) {
      startPolling();
    }

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [presales.length]); // Added the missing dependency array

  const formatAmount = (amount: string) => {
    return formatEther(BigInt(amount));
  };

  // Add a new function to format the rate properly
  const formatRate = (rate: string) => {
    // The presaleRate is already the number of tokens per SEI
    // (when accounting for both SEI and token decimals)
    const rateNumber = Number(rate);

    return rateNumber.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  };

  // Add a new function to format date and time
  const formatDateTime = (timestamp: string) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Live':
        return 'bg-primary/20 text-primary border border-primary/40';
      case 'Coming Soon':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
      case 'Ended':
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/40';
      case 'Finalized':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/40';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/40';
    }
  };

  const getButtonStyle = (status: string) => {
    switch (status) {
      case 'Live':
        return 'bg-gradient-primary hover:opacity-90 text-white font-bold py-2 px-4 rounded-lg transition-all cursor-pointer';
      case 'Coming Soon':
        return 'bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded-lg cursor-not-allowed';
      case 'Ended':
        return 'bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded-lg cursor-not-allowed';
      case 'Finalized':
        return 'bg-primary hover:bg-primary/80 text-white font-bold py-2 px-4 rounded-lg transition-all cursor-pointer';
      default:
        return 'bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded-lg cursor-not-allowed';
    }
  };

  const handleParticipate = (presale: PresaleData) => {
    // Encode presale data and navigate to participate page
    const presaleData = encodeURIComponent(JSON.stringify(presale));
    router.push(`/participate?data=${presaleData}`);
  };

  const handleButtonClick = (presale: PresaleData) => {
    if (presale.status === 'Live') {
      handleParticipate(presale);
    } else if (presale.status === 'Finalized') {
      // Navigate to participate page which will show swap interface for finalized tokens
      handleParticipate(presale);
    }
  };

  const filteredPresales = presales
    .filter((presale) => {
      if (filterStatus === 'All') {
        return true;
      }
      return presale.status === filterStatus;
    })
    .sort((a, b) => {
      // Sort by creation time (assuming newer tokens have higher indexes in the original array)
      const aIndex = presales.indexOf(a);
      const bIndex = presales.indexOf(b);

      if (sortOrder === 'desc') {
        return bIndex - aIndex; // Newest first
      } else {
        return aIndex - bIndex; // Oldest first
      }
    });

  return (
    <div className="min-h-screen bg-charcoal py-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Header Section with Animation */}
        <div className="text-center mb-12">
          <h1
            className="text-4xl font-bold text-light mb-4 opacity-0 animate-fadeInUp"
            style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
          >
            Welcome to Seipad
          </h1>
          <p
            className="text-xl text-gray-300 max-w-2xl mx-auto opacity-0 animate-fadeInUp"
            style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
          >
            Discover and participate in the latest token presales on the Sei blockchain. Join
            exciting projects early and be part of the next big thing.
          </p>
        </div>

        {/* How It Works with Staggered Animation */}
        <div
          className="bg-card rounded-2xl shadow-xl p-8 mb-8 opacity-0 animate-fadeInUp border border-primary/20"
          style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
        >
          <h2 className="text-2xl font-bold text-light mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div
              className="text-center opacity-0 animate-fadeInUp"
              style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}
            >
              <div
                className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounceIn border border-primary/30"
                style={{ animationDelay: '1s' }}
              >
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-bold text-lg mb-2 text-light">Connect Wallet</h3>
              <p className="text-gray-300">Connect your Sei wallet to get started</p>
            </div>
            <div
              className="text-center opacity-0 animate-fadeInUp"
              style={{ animationDelay: '1s', animationFillMode: 'forwards' }}
            >
              <div
                className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounceIn border border-primary/30"
                style={{ animationDelay: '1.2s' }}
              >
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-bold text-lg mb-2 text-light">Choose Project</h3>
              <p className="text-gray-300">Browse and select a presale project</p>
            </div>
            <div
              className="text-center opacity-0 animate-fadeInUp"
              style={{ animationDelay: '1.2s', animationFillMode: 'forwards' }}
            >
              <div
                className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounceIn border border-primary/30"
                style={{ animationDelay: '1.4s' }}
              >
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-bold text-lg mb-2 text-light">Participate</h3>
              <p className="text-gray-300">Contribute and claim your tokens</p>
            </div>
          </div>
        </div>

        {/* Featured Presales Section with Animation */}
        <div
          className="bg-card rounded-2xl shadow-xl p-8 mb-8 opacity-0 animate-fadeInUp border border-primary/20"
          style={{ animationDelay: '1.4s', animationFillMode: 'forwards' }}
        >
          <h2 className="text-2xl font-bold text-light mb-6">Featured Tokens</h2>

          {/* Filter and Sort buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            {/* Filter buttons */}
            <div className="flex space-x-2 bg-accent-dark rounded-lg p-1">
              {(['All', 'Live', 'Coming Soon', 'Ended', 'Finalized'] as FilterStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                      filterStatus === status
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-300 hover:text-primary hover:bg-primary/10'
                    }`}
                  >
                    <span className="relative z-10">
                      {status} (
                      {status === 'All'
                        ? presales.length
                        : presales.filter((p) => p.status === status).length}
                      )
                    </span>
                  </button>
                ),
              )}
            </div>

            {/* Sort buttons */}
            <div className="flex space-x-2 bg-accent-dark rounded-lg p-1">
              <button
                onClick={() => setSortOrder('desc')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                  sortOrder === 'desc'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-300 hover:text-primary hover:bg-primary/10'
                }`}
              >
                <span className="relative z-10">↓ Newest</span>
              </button>
              <button
                onClick={() => setSortOrder('asc')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                  sortOrder === 'asc'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-300 hover:text-primary hover:bg-primary/10'
                }`}
              >
                <span className="relative z-10">↑ Oldest</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-gray-300">Loading presales...</p>
            </div>
          ) : filteredPresales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-300">No presales found matching your filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredPresales.map((presale, index) => {
                const isFirstToken = index === 0;

                return (
                  <div
                    key={presale.poolAddress}
                    className={`bg-gradient-card rounded-xl p-6 border border-primary/30 flex flex-col justify-between relative backdrop-blur-sm ${
                      mounted && isFirstToken ? 'animate-violentShake' : ''
                    }`}
                    style={{
                      animationDelay: mounted && isFirstToken ? '0s' : '0s',
                      animationFillMode: 'forwards',
                      opacity: mounted && isFirstToken ? 1 : mounted ? 1 : 0,
                      ...(mounted &&
                        isFirstToken && {
                          animation: 'violentShake 1.2s ease-in-out forwards',
                        }),
                    }}
                  >
                    {/* New Token Badge */}
                    {newTokenAddress && presale.poolAddress === newTokenAddress && (
                      <div className="absolute -top-2 -right-2 bg-primary text-white text-xs px-2 py-1 rounded-full animate-pulse z-10 font-bold">
                        NEW!
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {/* Token Logo */}
                        <TokenImage poolAddress={presale.poolAddress} />
                        <h3 className="font-bold text-lg text-light">{presale.tokenName}</h3>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(
                          presale.status,
                        )}`}
                      >
                        {presale.status}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {presale.status !== 'Finalized' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Progress:</span>
                            <span className="font-semibold text-light">{presale.progress}%</span>
                          </div>
                          <div className="w-full bg-accent-dark rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-gradient-primary"
                              style={{
                                width: `${presale.progress}%`,
                              }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-300">
                              Raised: {formatAmount(presale.totalContributed)} SEI
                            </span>
                            <span className="text-gray-300">
                              Goal: {formatAmount(presale.softcap)} SEI
                            </span>
                          </div>
                        </>
                      )}

                      <div className="text-xs text-gray-400">
                        <div>
                          Rate: 1 SEI = {formatRate(presale.presaleRate)} {presale.tokenSymbol}
                        </div>
                        <div>Start: {formatDateTime(presale.startTime)}</div>
                        <div>End: {formatDateTime(presale.endTime)}</div>
                      </div>
                      <button
                        className={`w-full ${getButtonStyle(presale.status)}`}
                        disabled={presale.status !== 'Live' && presale.status !== 'Finalized'}
                        onClick={() => handleButtonClick(presale)}
                      >
                        {presale.status === 'Live'
                          ? 'Participate'
                          : presale.status === 'Finalized'
                          ? 'Swap'
                          : presale.status}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Section with Animation */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 opacity-0 animate-fadeInUp"
          style={{ animationDelay: '2s', animationFillMode: 'forwards' }}
        >
          <div className="bg-card rounded-xl p-6 text-center shadow-lg border border-primary/20">
            <div className="text-3xl font-bold mb-2 text-primary">{presales.length}</div>
            <div className="text-gray-300">Projects Launched</div>
          </div>
          <div className="bg-card rounded-xl p-6 text-center shadow-lg border border-primary/20">
            <div className="text-3xl font-bold mb-2 text-primary">
              {presales
                .reduce((total, presale) => total + Number(formatAmount(presale.hardcap)), 0)
                .toFixed(1)}{' '}
              SEI
            </div>
            <div className="text-gray-300">Total Goal</div>
          </div>
          <div className="bg-card rounded-xl p-6 text-center shadow-lg border border-primary/20">
            <div className="text-3xl font-bold mb-2 text-primary">
              {presales.filter((p) => p.status === 'Live').length}
            </div>
            <div className="text-gray-300">Active Presales</div>
          </div>
        </div>
      </div>
    </div>
  );
}
