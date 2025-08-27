'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useReadContract } from 'wagmi';
import { CONTRACTS } from '@/contracts/addresses';
import PoolManagerABI from '@/contracts/abis/PoolManager.json';
import PoolABI from '@/contracts/abis/Pool.json';

export default function FeaturedTokensCarousel() {
  const router = useRouter();

  // Get all presales from blockchain
  const { data: presales } = useReadContract({
    address: CONTRACTS.POOL_MANAGER,
    abi: PoolManagerABI,
    functionName: 'getAllPresales',
  });

  // Get data for up to 5 presales for the carousel
  const featuredPresales =
    Array.isArray(presales) && presales.length > 0 ? presales.slice(-5).reverse() : [];

  // Get data for each featured presale - using the exact same approach as FeaturedTokenSidebar
  const { data: presaleData1 } = useReadContract({
    address: featuredPresales[0] as `0x${string}`,
    abi: PoolABI,
    functionName: 'getPoolData',
  });

  const { data: presaleData2 } = useReadContract({
    address: featuredPresales[1] as `0x${string}`,
    abi: PoolABI,
    functionName: 'getPoolData',
  });

  const { data: presaleData3 } = useReadContract({
    address: featuredPresales[2] as `0x${string}`,
    abi: PoolABI,
    functionName: 'getPoolData',
  });

  const { data: presaleData4 } = useReadContract({
    address: featuredPresales[3] as `0x${string}`,
    abi: PoolABI,
    functionName: 'getPoolData',
  });

  const { data: presaleData5 } = useReadContract({
    address: featuredPresales[4] as `0x${string}`,
    abi: PoolABI,
    functionName: 'getPoolData',
  });

  const handleParticipate = (presaleData: any, poolAddress: string) => {
    if (presaleData) {
      // Create the presale data object that matches what ParticipateForm expects
      const presaleDataObj = {
        poolAddress: poolAddress,
        tokenName: presaleData.tokenName,
        tokenSymbol: presaleData.tokenSymbol,
        presaleRate: presaleData.presaleRate.toString(),
        softcap: presaleData.softcap.toString(),
        hardcap: presaleData.hardcap.toString(),
        startTime: presaleData.startTime.toString(),
        endTime: presaleData.endTime.toString(),
        status: 'Live', // Default status
      };

      // Navigate to participate page with the presale data
      const encodedData = encodeURIComponent(JSON.stringify(presaleDataObj));
      router.push(`/participate?data=${encodedData}`);
    }
  };

  // Show loading state if no presales yet
  if (!presales || (Array.isArray(presales) && presales.length === 0)) {
    return (
      <div className="w-full bg-gradient-charcoal py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Create array of available presale data
  const availablePresales = [
    { data: presaleData1, address: featuredPresales[0] },
    { data: presaleData2, address: featuredPresales[1] },
    { data: presaleData3, address: featuredPresales[2] },
    { data: presaleData4, address: featuredPresales[3] },
    { data: presaleData5, address: featuredPresales[4] },
  ].filter((item) => item.data && item.address);

  // If no presale data available yet, show loading
  if (availablePresales.length === 0) {
    return (
      <div className="w-full bg-gradient-charcoal py-8">
        <div className="w-full px-2">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Card component to avoid repetition
  const TokenCard = ({
    presale,
    uniqueKey,
    cardIndex,
  }: {
    presale: any;
    uniqueKey: string;
    cardIndex: number;
  }) => {
    const [tokenImage, setTokenImage] = useState<string>('');

    // Fetch token metadata on mount
    useEffect(() => {
      const fetchMetadata = async () => {
        try {
          const response = await fetch(`/api/token-metadata?address=${presale.address}`);
          if (response.ok) {
            const metadata = await response.json();
            setTokenImage(metadata.imageUrl || '');
          }
        } catch (error) {
          console.error('Failed to fetch metadata:', error);
        }
      };

      if (presale.address) {
        fetchMetadata();
      }
    }, [presale.address]);

    // Calculate background position for panoramic effect
    // Each card shows 20% of the image, positioned based on card index
    const backgroundPosition = `${cardIndex * 20}% center`;

    return (
      <div key={uniqueKey} className="slide flex-shrink-0">
        <div
          className="w-96 h-44 relative overflow-hidden rounded-xl mx-2 cursor-pointer hover:scale-105 transition-transform duration-300 bg-gradient-card border border-primary/30"
          onClick={() => handleParticipate(presale.data, presale.address)}
        >
          <div className="absolute inset-0 bg-gradient-primary opacity-10"></div>

          <div className="relative z-10 p-5 h-full flex flex-col justify-between">
            <div className="text-center">
              {/* Token Image or Star Icon */}
              {tokenImage ? (
                <img
                  src={tokenImage}
                  alt="Token logo"
                  className="w-16 h-16 rounded-full mx-auto mb-6 object-cover border-2 border-white/50 animate-bounce"
                />
              ) : (
                <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-6 flex items-center justify-center text-white text-lg font-bold animate-bounce border border-primary/50">
                  🚀
                </div>
              )}

              {/* Token Name */}
              <div className="flex items-center justify-center space-x-2">
                <p className="text-xl font-semibold text-white">
                  {(presale.data as any)?.tokenName ?? 'Loading...'}
                </p>
              </div>
            </div>

            <div className="text-center">
              <div className="px-6 py-3 text-sm text-white/80">Click to Participate</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-gradient-charcoal py-8">
      <div className="w-full px-2">
        {/* Proven Infinite Carousel - No Jumps */}
        <div className="slider overflow-hidden relative">
          <div className="slide-track flex animate-scroll">
            {/* Original set */}
            {availablePresales.map((presale, index) => (
              <TokenCard
                key={`original-${index}`}
                presale={presale}
                uniqueKey={`original-${index}`}
                cardIndex={index}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
