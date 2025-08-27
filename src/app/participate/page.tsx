"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const ParticipateForm = dynamic(
  () => import("../../components/ParticipateForm"),
  { ssr: false }
);

function ParticipateContent() {
  const searchParams = useSearchParams();
  const presaleData = searchParams.get("data");

  if (!presaleData) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-light mb-4">
            Invalid Presale
          </h1>
          <p className="text-gray-300">No presale data provided.</p>
        </div>
      </div>
    );
  }

  try {
    const presale = JSON.parse(decodeURIComponent(presaleData));
    return <ParticipateForm presale={presale} />;
  } catch (error) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-light mb-4">Error</h1>
          <p className="text-gray-300">Invalid presale data.</p>
        </div>
      </div>
    );
  }
}

export default function ParticipatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-charcoal flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-300">Loading...</p>
          </div>
        </div>
      }
    >
      <ParticipateContent />
    </Suspense>
  );
}
