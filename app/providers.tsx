"use client";
import { http } from "viem";
import { lisk } from "viem/chains";
import { PrivyProvider } from "@privy-io/react-auth";
import { createMeeClient, toMultichainNexusAccount } from "@biconomy/abstractjs";
import { useState, createContext, useContext, ReactNode, useEffect } from "react";



export default function AppProvider({ children }: { children: ReactNode }) {

  return (
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}    
        
        config={{
          loginMethods: ['email', 'wallet'],
          appearance: {
            theme: 'light',
            accentColor: '#676FFF',
            logo: '/public/logos/privy-logo.png',
          },
          embeddedWallets: {
            createOnLogin: "users-without-wallets",
          },
          defaultChain: lisk,
          supportedChains: [lisk],
        }}
      >
            {children}
      </PrivyProvider>
  );
}