"use client";

import React, { useState, useContext, createContext, ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { createSmartAccountClient, PaymasterMode } from "@biconomy/account";

import useContractInteractions from '@/hooks/contractInteractions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Step, StepStatus } from '@/components/TransactionSteps';
import { TransactionSteps } from '@/components/TransactionSteps';
import { ethers } from 'ethers';

type FreeClaimContextType = {
  isProcessing: boolean;
  handleWhitelist: () => Promise<void>;
  handleAttest: () => Promise<void>;
  handleClaim: () => Promise<void>;
  // Transaction dialog
  isTransactionDialogOpen: boolean;
  setIsTransactionDialogOpen: (open: boolean) => void;
  setTransactionSteps: (steps: Step[]) => void;
  setCurrentOperation: (operation: 'airtime' | null) => void;
  isWaitingTx: boolean;
  setIsWaitingTx: (waiting: boolean) => void;
  closeTransactionDialog: () => void;
  openTransactionDialog: (operation: 'airtime', recipientValue: string) => void;
  transactionSteps: Step[];
  currentOperation: "airtime" | null;
  updateStepStatus: (stepId: string, status: StepStatus, errorMessage?: string) => void;
};

const FreeClaimContext = createContext<FreeClaimContextType | undefined>(undefined);

export function FreeClaimProvider({ children }: { children: ReactNode }) {
  const { wallets } = useWallets();
  const { user, authenticated } = usePrivy();
  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
  const [address, setAddress] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [smartAccount, setSmartAccount] = useState<any>(null);
  const { whitelistSelf, submitAttestation, claimBundle,  } = useContractInteractions()
  // RPC URLs with fallbacks
  const RPC_URLS = [
    process.env.NEXT_PUBLIC_RPC_URL!
  ];
  
  const [currentRpcUrl, setCurrentRpcUrl] = useState<string>(RPC_URLS[0]);
  
  // Function to find a working RPC URL
  const getWorkingRpcUrl = async (): Promise<string> => {
    for (const url of RPC_URLS) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_blockNumber',
            params: []
          }),
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          console.log(`Using RPC URL: ${url}`);
          setCurrentRpcUrl(url);
          return url;
        }
      } catch (err) {
        console.warn(`RPC URL ${url} failed healthcheck`);
        // Continue to next URL
      }
    }
    
    console.warn("All RPC URLs failed, using default");
    // If all fail, return the first one anyway
    return RPC_URLS[0];
  };
  
  // Connect wallet with proper error handling
  const connectWallet = async (wallet: any): Promise<boolean> => {
    if (!wallet) {
      console.error("No wallet provided");
      return false;
    }

    try {
      const provider = await wallet.getEthereumProvider();
      
      if (!provider || typeof provider.request !== 'function') {
        console.error("Invalid wallet provider");
        return false;
      }

      // First explicitly request accounts to establish connection
      try {
        await provider.request({ method: 'eth_requestAccounts' });
      } catch (requestError) {
        console.warn("Error requesting accounts, trying to proceed anyway:", requestError);
        // Continue anyway as some wallet providers might not support this method
      }
      
      // If we get here, the connection was successful or we're trying to proceed anyway
      setProvider(provider);
      setIsWalletConnected(true);
      return true;
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      return false;
    }
  };

  // Initialize smart account client with proper error handling
  const initializeSmartAccount = async () => {
    if (!embeddedWallet) {
      throw new Error("No wallet provided");
    }

    try {
      // First connect the wallet
      const connected = await connectWallet(embeddedWallet);
      if (!connected) {
        throw new Error("Failed to connect wallet");
      }
      
      // Get a working RPC URL
      await getWorkingRpcUrl();
      
      let ethersProvider;
      try {
        // Get Ethereum provider from wallet
        const provider = await embeddedWallet.getEthereumProvider();
        
        // Request accounts explicitly to force connection
        if (provider && typeof provider.request === 'function') {
          try {
            await provider.request({ method: 'eth_requestAccounts' });
          } catch (accountsError) {
            console.warn("Error requesting accounts:", accountsError);
          }
        }
        
        // Create ethers provider
        ethersProvider = new ethers.providers.Web3Provider(provider);
      } catch (providerError) {
        console.error("Failed to create Web3Provider:", providerError);
        throw new Error("Could not initialize wallet provider");
      }
      
      if (!ethersProvider) {
        throw new Error("Could not initialize ethers provider");
      }
      
      // Get signer
      const ethersSigner = ethersProvider.getSigner();
      
      // Set proper defaults for Smart Account creation
      const biconomyBundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL!;
      
      const biconomyPaymasterUrl = process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_KEY!; 

      console.log("Creating smart account with:", {
        bundlerUrl: biconomyBundlerUrl,
        paymasterUrl: biconomyPaymasterUrl
      });

      // Create the smart account client with robust error handling
      try {
        const smartAccountClient = await createSmartAccountClient({
          signer: ethersSigner,
          bundlerUrl: biconomyBundlerUrl,
          biconomyPaymasterApiKey: biconomyPaymasterUrl
        });

        if (!smartAccountClient) {
          throw new Error("Smart account client returned null");
        }

        setSmartAccount(smartAccountClient);
        console.log("Smart account initialized successfully");
        return smartAccountClient;
      } catch (smartAccountError) {
        console.error("Error creating smart account client:", smartAccountError);
        throw new Error("Failed to initialize smart account: " + 
                      (smartAccountError instanceof Error ? smartAccountError.message : "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to initialize smart account:", error);
      throw error;
    }
  };

  // Initialize smart account when wallet is connected
  useEffect(() => {
    if (isWalletConnected && embeddedWallet && !smartAccount) {
      initializeSmartAccount().catch(error => {
        console.error("Failed to initialize smart account automatically:", error);
      });
    }
  }, [isWalletConnected, embeddedWallet]);

  useEffect(() => {
    // Create a flag to prevent race conditions
    let isMounted = true;

    const getWalletAddress = async () => {
      const currentEmbeddedWallet = wallets?.find((wallet) => wallet.walletClientType === 'privy');
      if (currentEmbeddedWallet) {
        try {
          // First try to connect the wallet and ensure we have an active connection
          await connectWallet(currentEmbeddedWallet);
          
          // Then get the address
          const walletAddress = await currentEmbeddedWallet.address;
          // Only update if component is still mounted
          if (isMounted && walletAddress !== address) {
            console.log("Setting wallet address:", walletAddress);
            setAddress(walletAddress);
          }
        } catch (error) {
          console.error("Error getting wallet address:", error);
        }
      } else if (isMounted && address !== null) {
        // Clear address if no wallet is found
        setAddress(null);
      }
    };

    if (authenticated && wallets?.length > 0) {
      getWalletAddress();
    } else if (!authenticated && address !== null) {
      // Clear address if not authenticated
      setAddress(null);
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [authenticated, wallets, address]);

  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [transactionSteps, setTransactionSteps] = useState<Step[]>([]);
  const [currentOperation, setCurrentOperation] = useState<'airtime' | null>(null);
  const [isWaitingTx, setIsWaitingTx] = useState(false);

  // Computed property for connection status
  const isConnected = authenticated && !!address && isWalletConnected;

  // Update step status helper function
  const updateStepStatus = (stepId: string, status: StepStatus, errorMessage?: string) => {
    setTransactionSteps(prevSteps => prevSteps.map(step =>
      step.id === stepId
        ? { ...step, status, ...(errorMessage ? { errorMessage } : {}) }
        : step
    ));
  };

  // Dialog helper functions
  const closeTransactionDialog = () => {
    setIsTransactionDialogOpen(false);
    setCurrentOperation(null);
    setTransactionSteps([]);
    setIsWaitingTx(false);
  };

  const openTransactionDialog = (operation: 'airtime', recipientValue: string) => {
    setCurrentOperation(operation);
    setIsTransactionDialogOpen(true);
    // Initialize steps based on operation
    if (operation === 'airtime') {
      setTransactionSteps([
        {
          id: 'whitelist', title: 'Whitelist Address', status: 'inactive',
          description: 'Whitelist your address to be eligible for the airtime bundle.'
        },
        {
          id: 'attestation', title: 'Submit Attestation', status: 'inactive',
          description: 'Verify your phone.'
        },
        {
          id: 'claim-ubi', title: 'Claim airtime Bundle', status: 'inactive',
          description: 'Claim your free airtime bundle once all prerequisites are met.'
        }
      ]);
    }
  };

  const getDialogTitle = () => {
    switch (currentOperation) {
      case 'airtime':
        return 'Claim Free airtime Bundle';
      default:
        return 'Transaction';
    }
  };

  // Handle whitelist function - First step
  const handleWhitelist = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    // Initialize smart account if not already initialized
    if (!smartAccount) {
      try {
        await initializeSmartAccount();
      } catch (error) {
        console.error("Could not initialize smart account for whitelist:", error);
        toast.error("Could not initialize your wallet. Please try again.");
        updateStepStatus('whitelist', 'error', "Failed to initialize wallet");
        return;
      }
    }

    try {
      updateStepStatus('whitelist', 'loading');
      setIsProcessing(true);

      const result = await whitelistSelf(user?.wallet?.address as `0x${string}`);
      if (result.success) {
        toast.success("Successfully added to whitelist!");
        updateStepStatus('whitelist', 'success');
      } else {
        toast.error("Failed to whitelist. Please try again.");
        updateStepStatus('whitelist', 'error', "Failed to add to whitelist");
      }
    } catch (error) {
      console.error("Error whitelisting:", error);
      toast.error("Error during whitelisting. Please try again.");
      updateStepStatus('whitelist', 'error', "Error during whitelisting");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle attestation function - Second step
  const handleAttest = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }
    
    // Initialize smart account if not already initialized
    if (!smartAccount) {
      try {
        await initializeSmartAccount();
      } catch (error) {
        console.error("Could not initialize smart account for attestation:", error);
        toast.error("Could not initialize your wallet. Please try again.");
        updateStepStatus('attestation', 'error', "Failed to initialize wallet");
        return;
      }
    }

    try {
      updateStepStatus('attestation', 'loading');
      setIsProcessing(true);
      const attestationText = `I, ${user?.wallet?.address}, attest that I am eligible for the free airtime bundle.`;
      const result = await submitAttestation( attestationText, user?.wallet?.address as `0x${string}`);

      if (result.success) {
        toast.success("Successfully completed attestation!");
        updateStepStatus('attestation', 'success');
      } else {
        toast.error("Failed to attest. Please try again.");
        updateStepStatus('attestation', 'error', "Failed to complete attestation");
      }
    } catch (error) {
      console.error("Error attesting:", error);
      toast.error("Error during attestation. Please try again.");
      updateStepStatus('attestation', 'error', "Error during attestation");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle claim bundle logic - Final step
  const handleClaim = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    // Initialize smart account if not already initialized
    if (!smartAccount) {
      try {
        await initializeSmartAccount();
      } catch (error) {
        console.error("Could not initialize smart account for claim:", error);
        toast.error("Could not initialize your wallet. Please try again.");
        updateStepStatus('claim-ubi', 'error', "Failed to initialize wallet");
        return;
      }
    }

    try {
      updateStepStatus('claim-ubi', 'loading');
      setIsProcessing(true);

      const result = await claimBundle(user?.wallet?.address as `0x${string}`);

      if (result?.success) {
        toast.success("Successfully claimed your free airtime bundle!");
        updateStepStatus('claim-ubi', 'success');
      } else if (result) {
        toast.error("You must wait before claiming again");
        updateStepStatus('claim-ubi', 'error', "You must wait before claiming again");
      } else {
        toast.error("Failed to claim airtime bundle");
        updateStepStatus('claim-ubi', 'error', "Failed to claim airtime bundle");
      }
    } catch (error) {
      console.error("Error claiming bundle:", error);
      toast.error("Error during claim. Please try again.");
      updateStepStatus('claim-ubi', 'error', "Error during claim process");
      return;
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if all steps are completed or if there's an error
  const allStepsCompleted = transactionSteps.every(step => step.status === 'success');
  const hasError = transactionSteps.some(step => step.status === 'error');

  const contextValue: FreeClaimContextType = {
    isProcessing,
    handleWhitelist,
    handleAttest,
    handleClaim,
    isTransactionDialogOpen,
    setIsTransactionDialogOpen,
    setTransactionSteps,
    setCurrentOperation,
    isWaitingTx,
    setIsWaitingTx,
    closeTransactionDialog,
    openTransactionDialog,
    transactionSteps,
    currentOperation,
    updateStepStatus
  };

  return (
    <FreeClaimContext.Provider value={contextValue}>
      {children}
      {/* Multi-step Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={(open: boolean) => !isWaitingTx && !open && closeTransactionDialog()}>
        <DialogContent className="sm:max-w-md border rounded-lg">
          <DialogHeader>
            <DialogTitle className='text-black/90 dark:text-white/90'>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              {currentOperation === 'airtime' && "Complete the steps below to claim your free airtime bundle."}
            </DialogDescription>
          </DialogHeader>

          {/* Transaction Steps */}
          <TransactionSteps steps={transactionSteps} />

          <DialogFooter className="flex justify-between text-black/90 dark:text-white/90">
            <Button
              onClick={closeTransactionDialog}
              disabled={isWaitingTx && !hasError}
            >
              {hasError ? 'Close' : allStepsCompleted ? 'Done' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FreeClaimContext.Provider>
  );
}

export function useFreeClaimProcessor() {
  const context = useContext(FreeClaimContext);
  if (!context) {
    throw new Error("useFreeClaimProcessor must be used within a FreeClaimProvider");
  }
  return context;
}
