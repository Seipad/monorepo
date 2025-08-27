"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import createConfig, { customTheme } from "@/rainbowKitConfig";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { FormProvider } from "@/contexts/FormContext";
import ClientOnly from "@/components/ClientOnly";

export function Providers(props: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ClientOnly>
      <Web3Providers queryClient={queryClient}>{props.children}</Web3Providers>
    </ClientOnly>
  );
}

function Web3Providers({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const config = createConfig();

  if (!config) {
    return (
      <QueryClientProvider client={queryClient}>
        <FormProvider>{children}</FormProvider>
      </QueryClientProvider>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme}>
          <FormProvider>{children}</FormProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
