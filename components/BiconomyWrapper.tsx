"use client";
import { useEffect, ReactNode } from "react";
import { useBiconomyAccount } from "@/hooks/useBiconomy";
import { useSmartAccount } from "@/app/providers";

interface BiconomyWrapperProps {
  children: ReactNode;
}

export default function BiconomyWrapper({ children }: BiconomyWrapperProps) {
  const { smartAccount: biconomyAccount } = useBiconomyAccount();
  const { setSmartAccount } = useSmartAccount();

  useEffect(() => {
    console.log('My Biconomy smart account', biconomyAccount);
    // Update the context with the Biconomy account
    if (biconomyAccount) {
      setSmartAccount(biconomyAccount);
    }
  }, [biconomyAccount, setSmartAccount]);

  return <>{children}</>;
}