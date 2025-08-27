"use client";

import dynamic from "next/dynamic";

// Dynamically import Header to prevent SSR issues with Web3 hooks
const Header = dynamic(() => import("./Header"), {
  ssr: false,
  loading: () => (
    <header className="w-full backdrop-blur-md border-b border-primary/20 sticky top-0 z-50 h-16 bg-charcoal/80">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-14 w-14 bg-card rounded"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-card rounded"></div>
        </div>
      </div>
    </header>
  ),
});

export default function ClientHeader() {
  return <Header />;
}
