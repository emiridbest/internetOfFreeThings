"use client";
import { http } from "viem";
import { lisk } from "viem/chains";
import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";



export default function AppProvider({ children }: { children: ReactNode }) {

  return (
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}    
        config={{
          loginMethods: ['email', 'wallet'],
          appearance: {
            theme: 'light',
            accentColor: '#676FFF',
            logo: 'https://github.com/emiridbest/internetOfFreeThings/blob/main/public/logo.svg',
          },
          embeddedWallets: {
            createOnLogin: "all-users",
          },
          defaultChain: lisk,
          supportedChains: [lisk],

        }}
      >
            {children}
      </PrivyProvider>
  );
}