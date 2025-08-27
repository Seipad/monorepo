'use client';

import { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import FeaturedTokensCarousel from './FeaturedTokensCarousel'; // Import the smooth carousel
import { CONTRACTS } from '@/contracts/addresses';

// PoolManager ABI for getting all presales
const POOL_MANAGER_ABI = [
  {
    inputs: [],
    name: 'getAllPresales',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'poolAddress', type: 'address' }],
    name: 'isFinalizable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Pool ABI for getting pool data and calling functions
const POOL_ABI = [
  {
    inputs: [],
    name: 'getPoolData',
    outputs: [
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'presaleRate', type: 'uint256' },
          { internalType: 'uint256', name: 'softcap', type: 'uint256' },
          { internalType: 'uint256', name: 'hardcap', type: 'uint256' },
          { internalType: 'uint256', name: 'liquidityRate', type: 'uint256' },
          { internalType: 'uint256', name: 'listingRate', type: 'uint256' },
          { internalType: 'uint256', name: 'startTime', type: 'uint256' },
          { internalType: 'uint256', name: 'endTime', type: 'uint256' },
          { internalType: 'bool', name: 'refund', type: 'bool' },
          { internalType: 'string', name: 'tokenName', type: 'string' },
          { internalType: 'string', name: 'tokenSymbol', type: 'string' },
        ],
        internalType: 'struct Presale',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: '_presaleStats',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'totalContributed',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'totalTokenAmount',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'totalClaimed', type: 'uint256' },
          { internalType: 'bool', name: 'isFinalized', type: 'bool' },
        ],
        internalType: 'struct Stats',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'finalize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'expressWithdrawal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ERC20 ABI for token balances
const ERC20_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface UserPosition {
  poolAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  presaleRate: string;
  status: 'Active' | 'Finalized' | 'Failed';
  startTime: number;
  endTime: number;
  softcap: string;
  hardcap: string;
  totalContributedPool: string;
  tokenBalance: string;
  isFinalizable: boolean; // Add this field
}

export default function MyPositions() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [pendingActions, setPendingActions] = useState<{
    [key: string]: string;
  }>({});

  const { writeContract, isPending, data: hash } = useWriteContract();

  // Wait for transaction receipt to reset button states
  const {
    isLoading: isConfirming,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Reset pending actions when transaction completes
  useEffect(() => {
    if (isSuccess || isError) {
      // Reset all pending actions
      setPendingActions({});

      // Refresh positions data after successful transaction
      if (isSuccess && allPresales) {
        fetchUserPositions();
      }
    }
  }, [isSuccess, isError]);

  // Get all presale addresses from PoolManager
  const { data: allPresales } = useReadContract({
    address: CONTRACTS.POOL_MANAGER,
    abi: POOL_MANAGER_ABI,
    functionName: 'getAllPresales',
  });

  // Fetch user's positions function
  const fetchUserPositions = async () => {
    if (!isConnected || !address || !allPresales) return;

    setLoading(true);
    const userPositions: UserPosition[] = [];

    try {
      for (const presaleAddress of allPresales) {
        // Get pool data
        const poolData = await publicClient.readContract({
          address: presaleAddress,
          abi: POOL_ABI,
          functionName: 'getPoolData',
        });

        // Get presale stats including isFinalized status
        const presaleStats = await publicClient.readContract({
          address: presaleAddress,
          abi: POOL_ABI,
          functionName: '_presaleStats',
        });

        // Check if the presale is finalizable using the PoolManager contract
        const isFinalizable = await publicClient.readContract({
          address: CONTRACTS.POOL_MANAGER,
          abi: POOL_MANAGER_ABI,
          functionName: 'isFinalizable',
          args: [presaleAddress],
        });

        // Get user's token balance
        const tokenBalance = await publicClient.readContract({
          address: poolData.token,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });

        if (tokenBalance > 0n) {
          const contractBalance = await publicClient.getBalance({
            address: presaleAddress,
          });
          const currentTime = Date.now() / 1000;

          // Use the isFinalized status from _presaleStats
          let status: 'Active' | 'Finalized' | 'Failed' = 'Active';

          if (presaleStats.isFinalized) {
            status = 'Finalized';
          } else if (currentTime > Number(poolData.endTime)) {
            // Presale ended but not finalized
            if (contractBalance >= poolData.softcap) {
              status = 'Ended (Ready to Finalize)';
            } else {
              status = 'Failed';
            }
          }

          userPositions.push({
            poolAddress: presaleAddress,
            tokenAddress: poolData.token,
            tokenName: poolData.tokenName,
            tokenSymbol: poolData.tokenSymbol,
            presaleRate: poolData.presaleRate.toString(),
            status,
            startTime: Number(poolData.startTime),
            endTime: Number(poolData.endTime),
            softcap: formatEther(poolData.softcap),
            hardcap: formatEther(poolData.hardcap),
            totalContributedPool: formatEther(contractBalance),
            tokenBalance: formatEther(tokenBalance),
            isFinalizable: isFinalizable,
          });
        }
      }

      setPositions(userPositions);
    } catch (error) {
      console.error('Error fetching user positions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's positions
  useEffect(() => {
    fetchUserPositions();
  }, [isConnected, address, allPresales, publicClient]);

  // Handle finalize action
  const handleFinalize = async (poolAddress: string, tokenSymbol: string) => {
    try {
      setPendingActions((prev) => ({
        ...prev,
        [`finalize-${poolAddress}`]: 'Finalizing...',
      }));

      writeContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'finalize',
      });
    } catch (error) {
      console.error('Error finalizing:', error);
      setPendingActions((prev) => ({
        ...prev,
        [`finalize-${poolAddress}`]: 'Error',
      }));
    }
  };

  // Handle withdraw action
  const handleWithdraw = async (poolAddress: string, tokenSymbol: string) => {
    try {
      setPendingActions((prev) => ({
        ...prev,
        [`withdraw-${poolAddress}`]: 'Withdrawing...',
      }));

      writeContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'expressWithdrawal',
      });
    } catch (error) {
      console.error('Error withdrawing:', error);
      setPendingActions((prev) => ({
        ...prev,
        [`withdraw-${poolAddress}`]: 'Error',
      }));
    }
  };

  // Fetch native token balance
  useEffect(() => {
    if (!isConnected || !address) return;

    const fetchNativeBalance = async () => {
      try {
        const balance = await publicClient.getBalance({ address });
        setNativeBalance(formatEther(balance));
      } catch (error) {
        console.error('Error fetching native balance:', error);
      }
    };

    fetchNativeBalance();
  }, [isConnected, address, publicClient]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-charcoal py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-light mb-4">My Positions</h1>
            <p className="text-xl text-gray-300 mb-8">Connect your wallet to view your positions</p>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pb-12">
      {/* Use the existing FeaturedTokenSidebar component */}
      <FeaturedTokensCarousel />

      {/* Main Content - Centered */}
      <div className="px-4">
        {' '}
        {/* Removed ml-56 since we're using carousel instead of sidebar */}
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-light mb-4">My Positions</h1>
            <p className="text-xl text-gray-300">
              Track your presale investments and token holdings
            </p>
          </div>

          {/* Native Token Balance */}
          <div className="bg-card rounded-2xl shadow-xl p-6 mb-8 border border-primary/20">
            <h2 className="text-2xl font-bold text-light mb-4">Wallet Balance</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Image
                  src="/SeiLaunchLogo.svg"
                  alt="Seipad Logo"
                  width={32}
                  height={32}
                  className="w-9 h-9"
                />
                <span className="text-lg font-medium text-light">Sei</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {parseFloat(nativeBalance).toFixed(4)}
              </span>
            </div>
          </div>

          {/* User Positions */}
          <div className="bg-card rounded-2xl shadow-xl p-6 border border-primary/20">
            <h2 className="text-2xl font-bold text-light mb-6">Presale Positions</h2>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-300">Loading your positions...</p>
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-300">You haven't participated in any presales yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {positions.map((position, index) => (
                  <div
                    key={index}
                    className="border border-primary/30 rounded-lg p-6 bg-gradient-card"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-light">
                          {position.tokenName} ({position.tokenSymbol})
                        </h3>
                        <p className="text-sm text-gray-300">
                          Pool:{' '}
                          <a
                            href={`https://seitrace.com/address/${position.poolAddress}?chain=atlantic-2`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 underline cursor-pointer"
                          >
                            {position.poolAddress.slice(0, 6)}...
                            {position.poolAddress.slice(-4)}
                          </a>
                        </p>
                        <p className="text-sm text-gray-300">
                          Token:{' '}
                          <a
                            href={`https://seitrace.com/address/${position.tokenAddress}?chain=atlantic-2`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 underline cursor-pointer"
                          >
                            {position.tokenAddress.slice(0, 6)}...
                            {position.tokenAddress.slice(-4)}
                          </a>
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          position.status === 'Active'
                            ? 'bg-primary/20 text-primary border border-primary/40'
                            : position.status === 'Finalized'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                        }`}
                      >
                        {position.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-300">Current Token Balance</p>
                        <p className="text-lg font-semibold text-light">
                          {position.tokenBalance} {position.tokenSymbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">Presale Rate</p>
                        <p className="text-sm font-medium text-light">
                          {position.presaleRate} {position.tokenSymbol} per SEI
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-300">Pool Progress</p>
                        <p className="text-sm font-medium text-light">
                          {position.totalContributedPool} / {position.hardcap} SEI
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-300">Softcap</p>
                        <p className="text-sm font-medium text-light">{position.softcap} SEI</p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 mb-4">
                      <p>Start: {new Date(position.startTime * 1000).toLocaleString()}</p>
                      <p>End: {new Date(position.endTime * 1000).toLocaleString()}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-primary/20">
                      <button
                        onClick={() => handleFinalize(position.poolAddress, position.tokenSymbol)}
                        disabled={isPending || isConfirming || !position.isFinalizable}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                          position.isFinalizable
                            ? 'bg-primary hover:bg-primary/80 text-white disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-300'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-center">
                          {pendingActions[`finalize-${position.poolAddress}`] ===
                            'Finalizing...' && (
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          )}
                          {pendingActions[`finalize-${position.poolAddress}`] || 'Finalize'}
                        </div>
                      </button>

                      <div className="relative group">
                        <button
                          onClick={() => handleWithdraw(position.poolAddress, position.tokenSymbol)}
                          disabled={isPending || isConfirming || position.status === 'Finalized'}
                          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                            position.status !== 'Finalized'
                              ? 'bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-300'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {pendingActions[`withdraw-${position.poolAddress}`] || 'Withdraw'}
                        </button>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          ⚠️ Premature withdrawal will incur a 20% fee
                          {/* Arrow pointing down */}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
