import { CONTRACTS } from '@/contracts/addresses';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';

const publicClient = createPublicClient({
  transport: http(process.env.RPC_URL),
});

// Fixed ABI definitions - using proper tuple syntax
const PoolManagerABI = parseAbi([
  'function getPresalesData(address poolAddress) view returns ((address token, uint256 presaleRate, uint256 softcap, uint256 hardcap, uint256 liquidityRate, uint256 listingRate, uint256 startTime, uint256 endTime, bool refund, string tokenName, string tokenSymbol))',
]);

const PoolABI = parseAbi([
  'function getPoolData() view returns ((address token, uint256 presaleRate, uint256 softcap, uint256 hardcap, uint256 liquidityRate, uint256 listingRate, uint256 startTime, uint256 endTime, bool refund, string tokenName, string tokenSymbol))',
  'function _presaleStats() view returns (uint256 totalContributed, uint256 totalTokenAmount, uint256 totalClaimed, bool isFinalized)',
]);

// Helper function to convert BigInt values to strings
function convertBigIntsToStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToStrings);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigIntsToStrings(value);
    }
    return result;
  }

  return obj;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  console.log(`API: Received request for address: ${address}`);

  if (!address) {
    console.log('API: No address provided');
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  try {
    console.log(`API: Fetching presale data for address: ${address}`);

    // Try to get data directly from the pool contract first
    let presaleData;
    let isFinalized = false;

    try {
      console.log('API: Trying direct pool contract call...');
      presaleData = await publicClient.readContract({
        address: address as `0x${string}`,
        abi: PoolABI,
        functionName: 'getPoolData',
      });
      console.log('API: Direct call successful:', presaleData);

      // Get the finalized status from the pool contract
      try {
        const stats = await publicClient.readContract({
          address: address as `0x${string}`,
          abi: PoolABI,
          functionName: '_presaleStats',
        });
        isFinalized = stats[3]; // isFinalized is the 4th element in the tuple
        console.log('API: Finalized status:', isFinalized);
      } catch (statsError) {
        console.log('API: Could not fetch finalized status:', statsError);
        isFinalized = false;
      }
    } catch (error) {
      console.log('API: Direct call failed, trying pool manager...', error);
      // If that fails, try to get it through the pool manager
      presaleData = await publicClient.readContract({
        address: CONTRACTS.POOL_MANAGER,
        abi: PoolManagerABI,
        functionName: 'getPresalesData',
        args: [address as `0x${string}`],
      });
      console.log('API: Pool manager call successful:', presaleData);
    }

    // Get the contract's balance as an approximation of total contributed
    const contractBalance = await publicClient.getBalance({
      address: address as `0x${string}`,
    });

    console.log(`API: Contract balance for ${address}:`, contractBalance.toString());

    // Combine presale data with balance and finalized status
    const combinedData = {
      ...presaleData,
      totalContributed: contractBalance,
      isFinalized: isFinalized,
    };

    // Convert BigInt values to strings for JSON serialization
    const serializedData = convertBigIntsToStrings(combinedData);
    console.log('API: Returning serialized presale data:', serializedData);

    return NextResponse.json(serializedData);
  } catch (error) {
    console.error('API: Error fetching presale data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch presale data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
