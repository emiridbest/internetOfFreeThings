"use client";
import { http } from "viem";
import { lisk } from "viem/chains";
import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";



export default function AppProvider({ children }: { children: ReactNode }) {

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
     // clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID!}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
          logo: 'https://www.freethings.xyz/favicon.ico',
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: lisk,
        supportedChains: [lisk],
        ...(typeof window !== 'undefined' ? {
          walletConnect: {
            projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || undefined,
            metadata: {
              name: 'FreeThings',
              description: 'Free data bundles and airtime',
              url: 'https://www.freethings.xyz',
              icons: [`https://www.freethings.xyz/favicon.ico`],
            }
          }
        } : {})
      }}
    >
      {children}
    </PrivyProvider>
  );
}