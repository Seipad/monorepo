'use client';

import { useState, useEffect } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem } from 'viem';
import PoolABI from '../contracts/abis/Pool.json';

interface TransactionListProps {
  poolAddress: string;
  tokenSymbol: string;
}

interface Transaction {
  type: 'buy' | 'sell' | 'mint' | 'burn';
  amount: string;
  timestamp: number;
  hash: string;
  user: string;
  blockNumber: number;
  from: string;
  to: string;
}

interface PoolData {
  token: string;
  presaleRate: string;
  softcap: string;
  hardcap: string;
  liquidityRate: string;
  listingRate: string;
  startTime: string;
  endTime: string;
  refund: boolean;
  tokenName: string;
  tokenSymbol: string;
}

export default function TransactionList({ poolAddress, tokenSymbol }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);

  const publicClient = usePublicClient();

  // Get the token address from the pool contract
  const { data: poolData } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: PoolABI,
    functionName: 'getPoolData',
  });

  // Get the token address when pool data is available
  useEffect(() => {
    if (poolData && (poolData as PoolData).token) {
      setTokenAddress((poolData as PoolData).token);
    }
  }, [poolData]);

  // Fetch real Transfer events from the token contract
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!tokenAddress || !publicClient) return;

      try {
        setIsLoading(true);
        setError(null);

        console.log('🔍 Fetching Transfer events for token:', tokenAddress);
        console.log('📍 Pool address:', poolAddress);

        // Get the latest block number
        const latestBlock = await publicClient.getBlockNumber();
        console.log('📦 Latest block:', latestBlock.toString());

        // Fetch Transfer events from the last 10000 blocks (increased range)
        const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n;
        console.log('📦 From block:', fromBlock.toString());
        console.log('📦 To block:', latestBlock.toString());
        console.log('📦 Block range size:', (latestBlock - fromBlock).toString());

        // First, let's try to get the token contract info to verify it exists
        try {
          const tokenCode = await publicClient.getBytecode({
            address: tokenAddress as `0x${string}`,
          });
          console.log(
            '🔍 Token contract bytecode length:',
            tokenCode ? tokenCode.length : 'No bytecode',
          );

          // Try to get basic token info
          try {
            const totalSupply = await publicClient.readContract({
              address: tokenAddress as `0x${string}`,
              abi: [
                {
                  constant: true,
                  inputs: [],
                  name: 'totalSupply',
                  outputs: [{ name: '', type: 'uint256' }],
                  type: 'function',
                },
              ],
              functionName: 'totalSupply',
            });
            console.log('🔍 Token total supply:', totalSupply?.toString());
          } catch (err) {
            console.log('⚠️ Could not read total supply:', err);
          }
        } catch (err) {
          console.error('❌ Error getting token bytecode:', err);
        }

        // Try to get all Transfer events using pagination to respect RPC limits
        console.log('🔍 Attempting to fetch Transfer events using pagination...');

        const MAX_BLOCK_RANGE = 2000n; // RPC limit
        let transferEvents: any[] = [];

        // Get the token's deployment block from metadata
        let deploymentBlock = 0n;
        let storedTokenAddress = null;
        try {
          console.log('🔍 Getting token deployment block from metadata...');
          console.log(`🔍 Searching by token address: ${tokenAddress}`);

          // Get deployment block and token address from token metadata
          const metadataResponse = await fetch(`/api/token-metadata?token-address=${tokenAddress}`);
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            if (metadata.deploymentBlock) {
              deploymentBlock = BigInt(metadata.deploymentBlock);
              console.log(`✅ Found deployment block in metadata: ${deploymentBlock.toString()}`);
            } else {
              console.log('⚠️ No deployment block found in metadata');
            }
            if (metadata.tokenAddress) {
              storedTokenAddress = metadata.tokenAddress;
              console.log(`✅ Found token address in metadata: ${storedTokenAddress}`);
            }
          } else {
            console.log('⚠️ Could not fetch token metadata');
          }

          if (deploymentBlock === 0n) {
            console.log('⚠️ No deployment block available, starting from block 0');
            deploymentBlock = 0n;
          } else {
            console.log(`🎯 Using deployment block from metadata: ${deploymentBlock.toString()}`);
          }
        } catch (err) {
          console.error('❌ Error getting deployment block from metadata:', err);
          console.log('⚠️ Falling back to starting from block 0');
          deploymentBlock = 0n;
        }

        // Helper function to fetch events in batches
        const fetchEventsInBatches = async (eventType: 'Transfer' | 'all') => {
          const events: any[] = [];
          let currentFromBlock = deploymentBlock; // Start from deployment block instead of 0

          while (currentFromBlock < latestBlock) {
            const currentToBlock = currentFromBlock + MAX_BLOCK_RANGE - 1n;
            const actualToBlock = currentToBlock > latestBlock ? latestBlock : currentToBlock;

            console.log(
              `📦 Fetching blocks ${currentFromBlock.toString()} to ${actualToBlock.toString()}`,
            );

            try {
              let batchEvents: any[] = [];

              if (eventType === 'Transfer') {
                // Fetch Transfer events specifically
                batchEvents = await publicClient.getLogs({
                  address: tokenAddress as `0x${string}`,
                  event: parseAbiItem(
                    'event Transfer(address indexed from, address indexed to, uint256 value)',
                  ),
                  fromBlock: currentFromBlock,
                  toBlock: actualToBlock,
                });
              } else {
                // Fetch all logs and filter for Transfer events
                const allLogs = await publicClient.getLogs({
                  address: tokenAddress as `0x${string}`,
                  fromBlock: currentFromBlock,
                  toBlock: actualToBlock,
                });

                const transferSignature =
                  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
                batchEvents = allLogs.filter(
                  (log) => log.topics && log.topics[0] === transferSignature,
                );
              }

              events.push(...batchEvents);
              console.log(
                `✅ Batch ${currentFromBlock.toString()}-${actualToBlock.toString()}: found ${
                  batchEvents.length
                } events`,
              );
            } catch (err) {
              console.error(
                `❌ Batch ${currentFromBlock.toString()}-${actualToBlock.toString()} failed:`,
                err,
              );
              // Continue with next batch even if this one fails
            }

            currentFromBlock = actualToBlock + 1n;
          }

          return events;
        };

        // Method 1: Fetch Transfer events using pagination
        try {
          console.log('🔄 Method 1: Fetching Transfer events with pagination...');
          const events1 = await fetchEventsInBatches('Transfer');
          console.log('📊 Method 1 found:', events1.length);
          transferEvents = events1;
        } catch (err) {
          console.error('❌ Method 1 failed:', err);
        }

        // Method 2: If Method 1 found few events, try fetching all logs with pagination
        if (transferEvents.length <= 1) {
          try {
            console.log('🔄 Method 2: Fetching all logs with pagination and filtering...');
            const events2 = await fetchEventsInBatches('all');
            console.log('📊 Method 2 found:', events2.length);

            if (events2.length > transferEvents.length) {
              console.log('✅ Method 2 found more events, using those instead');
              transferEvents = events2;
            }
          } catch (err) {
            console.error('❌ Method 2 failed:', err);
          }
        }

        console.log('📊 Final Transfer events found:', transferEvents.length);
        console.log('📊 Raw transfer events:', transferEvents);

        // Analyze the events we found
        if (transferEvents.length > 0) {
          console.log('🔍 Analyzing found events...');

          // Group events by type
          const eventsByType = {
            mint: transferEvents.filter(
              (e) => e.args?.from === '0x0000000000000000000000000000000000000000',
            ),
            burn: transferEvents.filter(
              (e) => e.args?.to === '0x0000000000000000000000000000000000000000',
            ),
            transfer: transferEvents.filter(
              (e) =>
                e.args?.from !== '0x0000000000000000000000000000000000000000' &&
                e.args?.to !== '0x0000000000000000000000000000000000000000',
            ),
          };

          console.log('📊 Events by type:', {
            mint: eventsByType.mint.length,
            burn: eventsByType.burn.length,
            transfer: eventsByType.transfer.length,
          });

          // Show details of each event type
          console.log(
            '🔍 Mint events:',
            eventsByType.mint.map((e) => ({
              block: e.blockNumber.toString(),
              hash: e.transactionHash,
              to: e.args?.to,
              value: e.args?.value?.toString(),
            })),
          );

          console.log(
            '🔍 Burn events:',
            eventsByType.burn.map((e) => ({
              block: e.blockNumber.toString(),
              hash: e.transactionHash,
              from: e.args?.from,
              value: e.args?.value?.toString(),
            })),
          );

          console.log(
            '🔍 Transfer events:',
            eventsByType.transfer.map((e) => ({
              block: e.blockNumber.toString(),
              hash: e.transactionHash,
              from: e.args?.from,
              to: e.args?.to,
              value: e.args?.value?.toString(),
            })),
          );

          // Check for any patterns in block numbers
          const blockNumbers = transferEvents
            .map((e) => Number(e.blockNumber))
            .sort((a, b) => a - b);
          console.log('📊 Block numbers where events occurred:', blockNumbers);
          console.log(
            '📊 Block number range:',
            Math.min(...blockNumbers),
            'to',
            Math.max(...blockNumbers),
          );
        }

        if (transferEvents.length === 0) {
          console.log('❌ No Transfer events found. Token might not have any transfers yet.');
          setTransactions([]);
          setError('No transfer events found for this token');
          // Don't return here - let the finally block handle loading state
        } else {
          // Log each event individually for debugging
          console.log('🔍 Analyzing each Transfer event:');
          transferEvents.forEach((event, index) => {
            console.log(`Event ${index + 1}:`, {
              blockNumber: event.blockNumber.toString(),
              transactionHash: event.transactionHash,
              from: event.args.from,
              to: event.args.to,
              value: event.args.value?.toString(),
              topics: event.topics,
              data: event.data,
            });
          });

          // Process the events into transactions
          const processedTransactions: Transaction[] = await Promise.all(
            transferEvents.map(async (event, index) => {
              console.log(`🔄 Processing event ${index + 1}/${transferEvents.length}:`, {
                blockNumber: event.blockNumber.toString(),
                transactionHash: event.transactionHash,
                from: event.args.from,
                to: event.args.to,
                value: event.args.value?.toString(),
              });

              // Get block details for timestamp
              const block = await publicClient.getBlock({
                blockNumber: event.blockNumber,
              });
              const timestamp = Number(block.timestamp) * 1000; // Convert to milliseconds

              // Ensure event args exist
              if (!event.args.from || !event.args.to || !event.args.value) {
                console.error('❌ Invalid event args:', event.args);
                throw new Error('Invalid event args');
              }

              // Determine transaction type based on from/to addresses
              let type: 'buy' | 'sell' | 'mint' | 'burn';
              let user: string;

              console.log('🔍 Analyzing transaction type:', {
                from: event.args.from,
                to: event.args.to,
                poolAddress: poolAddress.toLowerCase(),
                isFromZero: event.args.from === '0x0000000000000000000000000000000000000000',
                isToZero: event.args.to === '0x0000000000000000000000000000000000000000',
                isFromPool: event.args.from.toLowerCase() === poolAddress.toLowerCase(),
                isToPool: event.args.to.toLowerCase() === poolAddress.toLowerCase(),
              });

              if (event.args.from === '0x0000000000000000000000000000000000000000') {
                // Mint: from zero address
                type = 'mint';
                user = event.args.to;
                console.log('✅ Identified as MINT');
              } else if (event.args.to === '0x0000000000000000000000000000000000000000') {
                // Burn: to zero address
                type = 'burn';
                user = event.args.from;
                console.log('✅ Identified as BURN');
              } else if (event.args.from.toLowerCase() === poolAddress.toLowerCase()) {
                // Buy: from pool contract (presale participation)
                type = 'buy';
                user = event.args.to;
                console.log('✅ Identified as BUY');
              } else if (event.args.to.toLowerCase() === poolAddress.toLowerCase()) {
                // Sell: to pool contract (refund/withdrawal)
                type = 'sell';
                user = event.args.from;
                console.log('✅ Identified as SELL');
              } else {
                // Regular transfer between users
                type = 'buy'; // Default to buy for display
                user = event.args.to;
                console.log('✅ Identified as TRANSFER (defaulting to BUY)');
              }

              const transaction = {
                type,
                amount: event.args.value.toString(),
                timestamp,
                hash: event.transactionHash,
                user,
                blockNumber: Number(event.blockNumber),
                from: event.args.from,
                to: event.args.to,
              };

              console.log('✅ Created transaction:', transaction);
              return transaction;
            }),
          );

          console.log('📊 All processed transactions before sorting:', processedTransactions);
          console.log('📊 Processed transactions count:', processedTransactions.length);

          // Sort by timestamp (newest first)
          processedTransactions.sort((a, b) => b.timestamp - a.timestamp);
          console.log('📊 Transactions after sorting:', processedTransactions);

          // Take only the most recent 5 transactions (as requested)
          const recentTransactions = processedTransactions.slice(0, 5);
          console.log('📊 Recent transactions (first 5):', recentTransactions);

          // Remove duplicates based on transaction hash
          const uniqueTransactions = recentTransactions.filter(
            (transaction, index, self) =>
              index === self.findIndex((t) => t.hash === transaction.hash),
          );

          console.log('✅ Final processed transactions:', recentTransactions.length);
          console.log('✅ Unique transactions after deduplication:', uniqueTransactions.length);
          console.log('📊 All transactions:', recentTransactions);
          console.log('📊 Unique transactions:', uniqueTransactions);

          setTransactions(uniqueTransactions);
        }
      } catch (err) {
        console.error('❌ Error fetching transactions:', err);
        setError(
          `Failed to fetch transactions: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (tokenAddress) {
      console.log('🚀 Starting to fetch transactions for token:', tokenAddress);
      fetchTransactions();
    }
  }, [tokenAddress, publicClient, poolAddress]);

  const formatAmount = (amount: string) => {
    try {
      return formatEther(BigInt(amount));
    } catch {
      return '0';
    }
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'buy':
      case 'mint':
        return (
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </div>
        );
      case 'sell':
      case 'burn':
        return (
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'buy':
        return 'Buy';
      case 'sell':
        return 'Sell';
      case 'mint':
        return 'Mint';
      case 'burn':
        return 'Burn';
      default:
        return type;
    }
  };

  const getTransactionDescription = (tx: Transaction) => {
    switch (tx.type) {
      case 'mint':
        return `Minted ${formatAmount(tx.amount)} ${tokenSymbol}`;
      case 'burn':
        return `Burned ${formatAmount(tx.amount)} ${tokenSymbol}`;
      case 'buy':
        return `Bought ${formatAmount(tx.amount)} ${tokenSymbol}`;
      case 'sell':
        return `Sold ${formatAmount(tx.amount)} ${tokenSymbol}`;
      default:
        return `Transfer ${formatAmount(tx.amount)} ${tokenSymbol}`;
    }
  };

  return (
    <div className="bg-gradient-card border border-primary/30 rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-light">Recent Transactions</h3>
        <div className="flex items-center space-x-2">
          {tokenAddress && (
            <div className="text-xs text-gray-500">Token: {shortenAddress(tokenAddress)}</div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-orange-600 hover:text-orange-700 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      ) : !tokenAddress ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600">Loading token information...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600">No transactions found for this token</p>
          <p className="text-xs text-gray-500 mt-2">
            Transactions will appear here once the token is active
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx, index) => (
            <div
              key={index}
              className={`flex items-center space-x-4 p-4 rounded-lg border ${
                tx.type === 'buy' || tx.type === 'mint'
                  ? 'bg-primary/10 border-primary/20'
                  : 'bg-primary/10 border-primary/20'
              }`}
            >
              {/* Transaction Icon */}
              {getTransactionIcon(tx.type)}

              {/* Transaction Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-semibold text-sm ${
                        tx.type === 'buy' || tx.type === 'mint' ? 'text-primary' : 'text-primary'
                      }`}
                    >
                      {getTransactionTypeLabel(tx.type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatAmount(tx.amount)} {tokenSymbol}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDateTime(tx.timestamp)}</span>
                </div>

                <div className="mt-1">
                  <p className="text-xs text-gray-300">{getTransactionDescription(tx)}</p>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">From:</span>
                    <span className="text-xs font-mono text-gray-300">
                      {shortenAddress(tx.from)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">To:</span>
                    <span className="text-xs font-mono text-gray-300">{shortenAddress(tx.to)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">Block:</span>
                    <span className="text-xs font-mono text-gray-300">{tx.blockNumber}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">Hash:</span>
                    <span className="text-xs font-mono text-gray-300">{shortenHash(tx.hash)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Count */}
      {transactions.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Showing {transactions.length} most recent transactions
          </p>
        </div>
      )}
    </div>
  );
}
