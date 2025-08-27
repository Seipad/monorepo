'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { CONTRACTS } from '@/contracts/addresses';

// Uniswap V2 Router ABI for getAmountsOut and swap functions
const ROUTER_ABI = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'amountIn',
        type: 'uint256',
      },
      {
        internalType: 'address[]',
        name: 'path',
        type: 'address[]',
      },
    ],
    name: 'getAmountsOut',
    outputs: [
      {
        internalType: 'uint256[]',
        name: 'amounts',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'amountIn',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountOutMin',
        type: 'uint256',
      },
      {
        internalType: 'address[]',
        name: 'path',
        type: 'address[]',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'deadline',
        type: 'uint256',
      },
    ],
    name: 'swapExactTokensForSEI',
    outputs: [
      {
        internalType: 'uint256[]',
        name: 'amounts',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'amountIn',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amountOutMin',
        type: 'uint256',
      },
      {
        internalType: 'address[]',
        name: 'path',
        type: 'address[]',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'deadline',
        type: 'uint256',
      },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [
      {
        internalType: 'uint256[]',
        name: 'amounts',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'amountOutMin',
        type: 'uint256',
      },
      {
        internalType: 'address[]',
        name: 'path',
        type: 'address[]',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'deadline',
        type: 'uint256',
      },
    ],
    name: 'swapExactSEIForTokens',
    outputs: [
      {
        internalType: 'uint256[]',
        name: 'amounts',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

interface SwapInterfaceProps {
  poolAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
}

export default function SwapInterface({
  poolAddress,
  tokenName,
  tokenSymbol,
  tokenAddress,
}: SwapInterfaceProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [amountOut, setAmountOut] = useState<string>('0');

  // State for approval
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState<string>('0');

  // Write contract hook for swap transactions
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Function to approve tokens
  const handleApprove = async () => {
    if (!isConnected || !publicClient || !tokenAddress) {
      alert('Please connect your wallet first');
      return false;
    }

    try {
      console.log('🔐 Approving tokens for router...');

      // Call approve function on the token contract
      const result = await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            inputs: [
              { internalType: 'address', name: 'spender', type: 'address' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
            ],
            name: 'approve',
            outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'approve',
        args: [CONTRACTS.V2_ROUTER as `0x${string}`, parseEther(approvalAmount)],
      });

      console.log('🔐 Approval transaction sent:', result);

      // Wait for the approval transaction to be confirmed
      console.log('⏳ Waiting for approval confirmation...');
      await new Promise((resolve) => {
        const checkApproval = async () => {
          try {
            const newAllowance = await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: [
                {
                  inputs: [
                    { internalType: 'address', name: 'owner', type: 'address' },
                    {
                      internalType: 'address',
                      name: 'spender',
                      type: 'address',
                    },
                  ],
                  name: 'allowance',
                  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                  stateMutability: 'view',
                  type: 'function',
                },
              ],
              functionName: 'allowance',
              args: [address as `0x${string}`, CONTRACTS.V2_ROUTER as `0x${string}`],
            });

            const amountToApprove = parseEther(approvalAmount);
            if (newAllowance >= amountToApprove) {
              console.log('✅ Approval confirmed on blockchain!');
              resolve(true);
            } else {
              // Check again in 1 second
              setTimeout(checkApproval, 1000);
            }
          } catch (error) {
            console.error('Error checking approval status:', error);
            resolve(false);
          }
        };

        // Start checking after 2 seconds
        setTimeout(checkApproval, 2000);
      });

      return true;
    } catch (error) {
      console.error('Error approving tokens:', error);
      alert('Approval failed. Please try again.');
      return false;
    }
  };

  const handleSwap = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!publicClient) {
      alert('Blockchain connection not available');
      return;
    }

    console.log('🚀 handleSwap called with:', {
      swapDirection,
      needsApproval,
      amount,
      tokenAddress,
    });

    // For selling tokens, check and handle approval if needed
    if (swapDirection === 'sell') {
      try {
        console.log('🔍 Checking approval status...');
        const allowance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: [
            {
              inputs: [
                { internalType: 'address', name: 'owner', type: 'address' },
                { internalType: 'address', name: 'spender', type: 'address' },
              ],
              name: 'allowance',
              outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'allowance',
          args: [address as `0x${string}`, CONTRACTS.V2_ROUTER as `0x${string}`],
        });

        const amountToApprove = parseEther(amount);
        console.log('🔐 Current allowance:', formatEther(allowance), 'Amount needed:', amount);

        if (allowance < amountToApprove) {
          console.log('⚠️ Insufficient allowance, approving first...');

          // Call approve and wait for the transaction to be confirmed
          const approveResult = await handleApprove();

          if (!approveResult) {
            console.log('❌ Approval failed, cannot proceed');
            alert('Token approval failed. Please try again.');
            return;
          }

          console.log('✅ Approval successful, proceeding with swap...');
        }
      } catch (error) {
        console.error('Error checking/handling approval:', error);
        alert('Could not verify token approval. Please try again.');
        return;
      }
    }

    try {
      setIsLoading(true);

      console.log('🚀 Starting swap execution...');
      console.log('📊 Swap details:', {
        direction: swapDirection,
        amount: amount,
        tokenAddress: tokenAddress,
        wethAddress: CONTRACTS.WETH,
        routerAddress: CONTRACTS.V2_ROUTER,
        userAddress: address,
      });

      // Convert amount to wei (18 decimals)
      const amountInWei = parseEther(amount);
      console.log('💰 Amount in wei:', amountInWei.toString());

      // Calculate minimum amount out based on slippage
      const slippage = 5; // Default 5% slippage
      // Convert amountOut to wei first, then apply slippage
      const amountOutWei = parseEther(amountOut);
      const minAmountOut = (amountOutWei * BigInt(100 - slippage)) / BigInt(100);
      console.log('📉 Min amount out:', minAmountOut.toString());

      // Determine the path based on swap direction
      let path: `0x${string}`[];
      if (swapDirection === 'buy') {
        // Buy tokens: Sei -> Token (using WETH address for path, but sending native ETH)
        path = [CONTRACTS.WETH as `0x${string}`, tokenAddress as `0x${string}`];
      } else {
        // Sell tokens: Token -> Sei (using WETH address for path, but receiving native ETH)
        path = [tokenAddress as `0x${string}`, CONTRACTS.WETH as `0x${string}`];
      }
      console.log('🛤️ Swap path:', path);

      // Set deadline to current block timestamp + 30 seconds
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 30);
      console.log('⏰ Deadline:', deadline.toString());

      console.log('📝 Calling writeContract with args:', [
        amountInWei.toString(),
        minAmountOut.toString(),
        path,
        address,
        deadline.toString(),
      ]);

      // Execute the swap based on direction
      if (swapDirection === 'buy') {
        // Buy tokens: Sei -> Token (use swapExactSEIForTokens)
        console.log('🟢 Executing buy swap with swapExactSEIForTokens');
        writeContract({
          address: CONTRACTS.V2_ROUTER as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'swapExactSEIForTokens',
          args: [
            minAmountOut,
            path,
            address as `0x${string}`, // recipient address
            deadline,
          ],
          value: amountInWei, // Send Sei ETH with the transaction
        });
      } else {
        // Sell tokens: Token -> Sei (use swapTokensForExactSEI)
        console.log('🔴 Executing sell swap with swapTokensForExactSEI');
        writeContract({
          address: CONTRACTS.V2_ROUTER as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'swapExactTokensForSEI',
          args: [
            amountInWei,
            minAmountOut,
            path,
            address as `0x${string}`, // recipient address
            deadline,
          ],
        });
      }
    } catch (error) {
      console.error('❌ Error during swap:', error);
      alert(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get swap amounts from Uniswap V2 router
  const getSwapAmounts = async (amountIn: string, direction: 'buy' | 'sell') => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !publicClient) {
      setAmountOut('0');
      return;
    }

    try {
      // Convert amount to wei (18 decimals)
      const amountInWei = parseEther(amountIn);

      // Determine the path based on swap direction
      let path: `0x${string}`[];
      if (direction === 'buy') {
        // Buy tokens: Sei -> Token (using WETH address for path, but sending native ETH)
        path = [CONTRACTS.WETH as `0x${string}`, tokenAddress as `0x${string}`];
      } else {
        // Sell tokens: Token -> Sei (using WETH address for path, but receiving native ETH)
        path = [tokenAddress as `0x${string}`, CONTRACTS.WETH as `0x${string}`];
      }

      // Call getAmountsOut on the router
      const amounts = await publicClient.readContract({
        address: CONTRACTS.V2_ROUTER as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountInWei, path],
      });

      if (amounts && amounts.length >= 2) {
        // amounts[0] is amount in, amounts[1] is amount out
        const outputAmount = formatEther(amounts[1]);
        setAmountOut(outputAmount);
      } else {
        setAmountOut('0');
      }
    } catch (error) {
      console.error('Error getting swap amounts:', error);
      setAmountOut('0');
    }
  };

  // Update amounts when amount or direction changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      getSwapAmounts(amount, swapDirection);
    } else {
      setAmountOut('0');
    }
  }, [amount, swapDirection, tokenAddress]);

  // Check if liquidity pair exists and get token balances
  useEffect(() => {
    const checkLiquidityPair = async () => {
      if (!publicClient || !tokenAddress || !address) return;

      try {
        // Try to get amounts for a small amount to check if pair exists
        const testAmount = parseEther('0.001');
        const testPath = [CONTRACTS.WETH as `0x${string}`, tokenAddress as `0x${string}`];

        const amounts = await publicClient.readContract({
          address: CONTRACTS.V2_ROUTER as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [testAmount, testPath],
        });

        console.log('✅ Liquidity pair exists, test amounts:', amounts);

        // Check ETH balance (for buy operations)
        const balance = await publicClient.getBalance({
          address: address as `0x${string}`,
        });
        console.log('💰Balance:', formatEther(balance));

        // Check token balance and approval (if selling)
        if (swapDirection === 'sell') {
          try {
            const [tokenBalance, allowance] = await Promise.all([
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: [
                  {
                    inputs: [
                      {
                        internalType: 'address',
                        name: 'account',
                        type: 'address',
                      },
                    ],
                    name: 'balanceOf',
                    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                  },
                ],
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
              }),
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: [
                  {
                    inputs: [
                      {
                        internalType: 'address',
                        name: 'owner',
                        type: 'address',
                      },
                      {
                        internalType: 'address',
                        name: 'spender',
                        type: 'address',
                      },
                    ],
                    name: 'allowance',
                    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                  },
                ],
                functionName: 'allowance',
                args: [address as `0x${string}`, CONTRACTS.V2_ROUTER as `0x${string}`],
              }),
            ]);

            console.log('🪙 Token Balance:', formatEther(tokenBalance));
            console.log('🔐 Current Allowance:', formatEther(allowance));

            // Check if approval is needed
            const amountToApprove = parseEther(amount);
            console.log('🔍 Approval check:', {
              currentAllowance: formatEther(allowance),
              amountToApprove: amount,
              needsApproval: allowance < amountToApprove,
            });

            if (allowance < amountToApprove) {
              setNeedsApproval(true);
              setApprovalAmount(amount);
              console.log('⚠️ Approval needed for amount:', amount);
            } else {
              setNeedsApproval(false);
              setApprovalAmount('0');
              console.log('✅ Sufficient allowance, no approval needed');
            }
          } catch (error) {
            console.log('⚠️ Could not check token balance/approval:', error);
          }
        }
      } catch (error) {
        console.error('❌ No liquidity pair found:', error);
      }
    };

    checkLiquidityPair();
  }, [publicClient, tokenAddress, address, swapDirection, amount]);

  // Refresh approval status after successful approval
  useEffect(() => {
    if (isSuccess && needsApproval) {
      console.log('✅ Approval successful, refreshing status...');
      // Trigger a re-check by updating the amount (which will trigger the liquidity check)
      setAmount(amount);
    }
  }, [isSuccess, needsApproval, amount]);

  const calculateOutput = () => {
    if (!amount || parseFloat(amount) <= 0) return '0';

    // Return the real amount from blockchain
    return parseFloat(amountOut).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  };

  return (
    <div className="bg-gradient-card border border-primary/30 rounded-2xl shadow-xl p-6 mb-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Side - Token Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
              ⭐
            </div>
            <div>
              <h2 className="text-2xl font-bold text-light">{tokenName}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <span className="text-gray-600">Token:</span>
              <span className="font-semibold ml-2">
                {tokenName} ({tokenSymbol})
              </span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="font-semibold ml-2 text-primary">Finalized & Listed</span>
            </div>
            <div>
              <span className="text-gray-600">Token Address:</span>
              <a
                href={`https://seiscan.io/token/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs font-semibold ml-2 text-primary hover:text-primary/80 cursor-pointer"
              >
                {tokenAddress}
              </a>
            </div>
          </div>
        </div>

        {/* Right Side - Swap Form */}
        <div className="lg:w-96">
          <h3 className="text-xl font-bold text-light mb-6">Swap Interface</h3>

          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Please connect your wallet to swap</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Swap Direction Toggle */}
              <div className="flex bg-primary/10 rounded-lg p-2">
                <button
                  onClick={() => setSwapDirection('buy')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    swapDirection === 'buy'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-600 hover:text-primary'
                  }`}
                >
                  Buy {tokenSymbol}
                </button>
                <button
                  onClick={() => setSwapDirection('sell')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    swapDirection === 'sell'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-600 hover:text-primary'
                  }`}
                >
                  Sell {tokenSymbol}
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label
                  htmlFor="swapAmount"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {swapDirection === 'buy' ? 'Amount (Sei)' : `Amount (${tokenSymbol})`}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="swapAmount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    min="0"
                    step="0.001"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-500">
                    {swapDirection === 'buy' ? 'Sei' : tokenSymbol}
                  </div>
                </div>
              </div>

              {/* Swap Arrow */}
              <div className="flex justify-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </div>
              </div>

              {/* Output Amount */}
              {amount && parseFloat(amount) > 0 && (
                <div className="bg-primary/10 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span>You will receive approximately:</span>
                    <span className="font-bold text-red-800">
                      {calculateOutput()} {swapDirection === 'buy' ? tokenSymbol : 'Sei'}
                    </span>
                  </div>
                </div>
              )}

              {/* Slippage Input */}
              <div>
                <label htmlFor="slippage" className="block text-sm font-medium text-gray-700 mb-2">
                  Slippage Tolerance (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="slippage"
                    defaultValue="5"
                    min="0.1"
                    max="50"
                    step="0.1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="5.0"
                  />
                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-500">
                    %
                  </div>
                </div>
              </div>

              {/* Unified Swap Button */}
              <button
                onClick={handleSwap}
                disabled={!amount || parseFloat(amount) <= 0 || isPending || isConfirming}
                className={`w-full py-3 px-6 rounded-lg font-bold transition-colors ${
                  !amount || parseFloat(amount) <= 0 || isPending || isConfirming
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : swapDirection === 'buy'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isPending
                  ? 'Confirming...'
                  : isConfirming
                  ? 'Processing...'
                  : swapDirection === 'buy'
                  ? `Buy ${tokenSymbol}`
                  : `Sell ${tokenSymbol}`}
              </button>

              {/* Transaction Status */}
              {isSuccess && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">
                        Swap successful! Your transaction has been completed.
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        You received: {calculateOutput()}{' '}
                        {swapDirection === 'buy' ? tokenSymbol : 'Sei'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">Error: {error.message}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
