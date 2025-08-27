'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from '@/contexts/FormContext';
import { useAccount } from 'wagmi';

export default function Header() {
  const { setActiveForm } = useForm();
  const { isConnected } = useAccount();

  return (
    <header className="w-full backdrop-blur-md border-b border-primary/20 sticky top-0 z-50">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0 bg-gradient-charcoal"></div>

      {/* Header Content */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left Side - Logo */}
          <div className="flex items-center -ml-4">
            <Link
              href="/"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity brightness-110 hover:scale-105"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/';
              }}
            >
              <Image
                src="/SeiLaunchLogo.svg"
                alt="Seipad Logo"
                width={124}
                height={124}
                className="w-12 h-auto"
              />
            </Link>
          </div>

          {/* Center - Create Token (always centered) */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="">
              <button
                className="relative group cursor-pointer"
                onClick={() => {
                  setActiveForm('create');
                  window.location.href = '/?form=create';
                }}
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-lg opacity-75 group-hover:opacity-100 transition-all duration-300 animate-pulse"></div>
                {/* Button Content */}
                <Link href="/?form=create">
                  <div className="relative bg-gradient-primary text-white px-6 py-2 rounded-lg font-bold transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-2xl cursor-pointer">
                    Create Token
                  </div>
                </Link>
              </button>
            </div>
          </div>

          {/* My Positions Button - Between Home and Create Token */}
          {isConnected && (
            <div
              className="absolute left-1/2 transform -translate-x-1/2"
              style={{ marginLeft: '-160px' }}
            >
              <button
                className="bg-card hover:bg-primary hover:text-white text-light px-4 py-2 rounded-lg font-bold border border-primary/30 transition-all duration-200 hover:scale-105"
                onClick={() => (window.location.href = '/my-positions')}
              >
                Profile
              </button>
            </div>
          )}

          {/* Right Side - Connect Button */}
          <div className="flex items-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
