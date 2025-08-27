"use client";

import { useForm } from "@/contexts/FormContext";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamically import components to prevent SSR issues
const HomeForm = dynamic(() => import("@/components/HomeForm"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-pulse text-center">
        <div className="h-8 bg-card rounded mb-4 w-64"></div>
        <div className="h-6 bg-card rounded w-48"></div>
      </div>
    </div>
  ),
});

const CreateCoinForm = dynamic(() => import("@/components/CreateCoinForm"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-pulse text-center">
        <div className="h-8 bg-card rounded mb-4 w-64"></div>
        <div className="h-6 bg-card rounded w-48"></div>
      </div>
    </div>
  ),
});

const FeaturedTokensCarousel = dynamic(
  () => import("@/components/FeaturedTokensCarousel"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full bg-gradient-charcoal py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-light mb-6 text-center">
            Featured Tokens
          </h2>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    ),
  }
);

function HomeContent() {
  const { activeForm, setActiveForm } = useForm();
  const searchParams = useSearchParams();

  useEffect(() => {
    const form = searchParams.get("form");
    if (form === "create") {
      setActiveForm("create");
    } else if (form === "home") {
      setActiveForm("home");
    }
  }, [searchParams, setActiveForm]);

  return (
    <div className="flex flex-col">
      {/* Featured Tokens Carousel below navbar */}
      <FeaturedTokensCarousel />

      {/* Main content */}
      <main className="flex-1">
        {activeForm === "home" && <HomeForm />}
        {activeForm === "create" && <CreateCoinForm />}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-charcoal">
          <div className="w-full bg-gradient-charcoal py-8">
            <div className="max-w-6xl mx-auto px-4">
              <div className="animate-pulse">
                <div className="h-6 bg-card rounded mb-4"></div>
                <div className="h-20 bg-card rounded"></div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
