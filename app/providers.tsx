"use client";
import { http } from "viem";
import { lisk } from "viem/chains";
import { WagmiProvider, createConfig } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZeroDevSmartWalletConnectors } from "@dynamic-labs/ethereum-aa";
import {
  DynamicContextProvider,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { useState, createContext, useContext, ReactNode } from "react";

// Create context for smart account
interface SmartAccountContextType {
  smartAccount: any;
  setSmartAccount: (account: any) => void;
}

const SmartAccountContext = createContext<SmartAccountContextType | undefined>(undefined);

export const useSmartAccount = () => {
  const context = useContext(SmartAccountContext);
  if (!context) {
    throw new Error('useSmartAccount must be used within SmartAccountProvider');
  }
  return context;
};

export default function AppProvider({ children }: { children: ReactNode }) {
  const config = createConfig({
    chains: [lisk],
    transports: {
      [lisk.id]: http(),
    },
  });

  const [smartAccount, setSmartAccount] = useState(null);

  const evmNetworks = [
    {
      blockExplorerUrls: ['https://blockscout.lisk.com/'],
      chainId: 1135,
      chainName: 'Lisk Mainnet',
      iconUrls: ['https://app.dynamic.xyz/assets/networks/lisk.svg'],
      name: 'Lisk',
      nativeCurrency: {
        decimals: 8,
        name: 'Lisk',
        symbol: 'LSK',
        iconUrl: 'https://app.dynamic.xyz/assets/networks/lisk.svg',
      },
      networkId: 1135,
      rpcUrls: ['https://rpc.lisk.com'],
      vanityName: 'Lisk Mainnet',
    }
  ];

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <DynamicContextProvider
          settings={{
            environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
            walletConnectors: [EthereumWalletConnectors, ZeroDevSmartWalletConnectors],
            overrides: {
              evmNetworks
            },
          }}
        >
          <SmartAccountContext.Provider value={{ smartAccount, setSmartAccount }}>
            {children}
          </SmartAccountContext.Provider>
        </DynamicContextProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}