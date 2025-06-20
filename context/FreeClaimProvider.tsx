"use client";

import React, { useState, useContext, createContext, ReactNode, useEffect } from 'react';
import { useAccount } from "wagmi";
import { toast } from 'sonner';
import { 
  getUserStatus, 
  whitelistSelf, 
  submitAttestation, 
  claimBundle,
  formatTimeRemaining,
} from '@/hooks/contractInteractions';
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

type FreeClaimContextType = {
  isWhitelisted: boolean;
  hasAttested: boolean;
  canClaim: boolean;
  timeUntilNextClaim: string;
  isProcessing: boolean;
  handleWhitelist: () => Promise<void>;
  handleAttest: () => Promise<void>;
  handleClaim: () => Promise<void>;
  // Transaction dialog
  isTransactionDialogOpen: boolean;
  setIsTransactionDialogOpen: (open: boolean) => void;
  setTransactionSteps: (steps: Step[]) => void;
  setCurrentOperation: (operation: 'data' | null) => void;
  isWaitingTx?: boolean;
  setIsWaitingTx?: (waiting: boolean) => void;
  closeTransactionDialog: () => void;
  openTransactionDialog: (operation: 'data', recipientValue: string) => void;
  transactionSteps: Step[];
  currentOperation: "data" | null;
  updateStepStatus: (stepId: string, status: StepStatus, errorMessage?: string) => void;
};

const FreeClaimContext = createContext<FreeClaimContextType | undefined>(undefined);

export function FreeClaimProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  
  // State management
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [hasAttested, setHasAttested] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState("Loading...");
  const [nextClaimTimestamp, setNextClaimTimestamp] = useState(0);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [transactionSteps, setTransactionSteps] = useState<Step[]>([]);
  const [currentOperation, setCurrentOperation] = useState<'data' | null>(null);
  const [isWaitingTx, setIsWaitingTx] = useState(false);
  
  // Fetch user's contract status
  useEffect(() => {
    async function fetchUserContractStatus() {
      if (address && isConnected) {
        try {
          const status = await getUserStatus(address as `0x${string}`);
          
          setIsWhitelisted(status.isWhitelisted);
          setHasAttested(status.hasAttested);
          setCanClaim(status.canClaim);
          
          if (status.nextAvailableTime > 0) {
            // Set next claim timestamp for countdown timer
            setNextClaimTimestamp(status.nextAvailableTime);
            setTimeUntilNextClaim(formatTimeRemaining(status.nextAvailableTime - Math.floor(Date.now() / 1000)));
          } else if (status.isWhitelisted && status.hasAttested) {
            setTimeUntilNextClaim("Available now");
          } else {
            setTimeUntilNextClaim("Complete prerequisites first");
          }
        } catch (error) {
          console.error("Error fetching contract status:", error);
        }
      }
    }

    fetchUserContractStatus();
    
    // Set up interval to refresh countdown timer
    const interval = setInterval(() => {
      if (nextClaimTimestamp > 0) {
        const now = Math.floor(Date.now() / 1000);
        if (now >= nextClaimTimestamp) {
          setCanClaim(isWhitelisted && hasAttested);
          setTimeUntilNextClaim("Available now");
          setNextClaimTimestamp(0);
        } else {
          setTimeUntilNextClaim(formatTimeRemaining(nextClaimTimestamp - now));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [address, isConnected, nextClaimTimestamp, isWhitelisted, hasAttested]);

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

  const openTransactionDialog = (operation: 'data', recipientValue: string) => {
    setCurrentOperation(operation);
    setIsTransactionDialogOpen(true);
    // Initialize steps based on operation
    if (operation === 'data') {
      setTransactionSteps([
        {
            id: 'whitelist', title: 'Whitelist Address', status: 'inactive',
            description: 'Whitelist your address to be eligible for the data bundle.'
        },
        {
            id: 'attestation', title: 'Submit Attestation', status: 'inactive',
            description: 'Verify your identity by submitting an attestation.'
        },
        {
            id: 'claim-ubi', title: 'Claim Data Bundle', status: 'inactive',
            description: 'Claim your free data bundle once all prerequisites are met.'
        }
      ]);
    }
  };

  const getDialogTitle = () => {
    switch (currentOperation) {
      case 'data':
        return 'Claim Free Data Bundle';
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
    
    if (isWhitelisted) {
      toast.success("Your address is already whitelisted");
      return;
    }

    try {
      updateStepStatus('whitelist', 'loading');
      setIsProcessing(true);
      
      const result = await whitelistSelf(address);
      
      if (result.success) {
        setIsWhitelisted(true);
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
    
    if (!isWhitelisted) {
      toast.error("You must whitelist your address first");
      return;
    }
    
    if (hasAttested) {
      toast.success("You have already completed attestation");
      return;
    }

    try {
      updateStepStatus('attestation', 'loading');
      setIsProcessing(true);
      
      const attestationText = "I verify I am a unique individual claiming a free data bundle.";
      const result = await submitAttestation(address as `0x${string}`, attestationText);
      
      if (result.success) {
        setHasAttested(true);
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
    
    if (!isWhitelisted) {
      toast.error("You must whitelist your address first");
      return;
    }
    
    if (!hasAttested) {
      toast.error("You must complete attestation first");
      return;
    }

    try {
      updateStepStatus('claim-ubi', 'loading');
      setIsProcessing(true);
      
      const result = await claimBundle(address as `0x${string}`);
      
      if (result.success) {
        toast.success("Successfully claimed your data bundle!");
        updateStepStatus('claim-ubi', 'success');
        
        // Refresh user status
        const status = await getUserStatus(address as `0x${string}`);
        setCanClaim(status.canClaim);
        
        if (status.nextAvailableTime > 0) {
          setNextClaimTimestamp(status.nextAvailableTime);
          setTimeUntilNextClaim(formatTimeRemaining(status.nextAvailableTime - Math.floor(Date.now() / 1000)));
        }
      } else {
        if (result.isClaimTooSoonError) {
          toast.error("You must wait before claiming again.");
          updateStepStatus('claim-ubi', 'error', "You must wait before claiming again");
          
          // Refresh time remaining
          const status = await getUserStatus(address as `0x${string}`);
          if (status.nextAvailableTime > 0) {
            setNextClaimTimestamp(status.nextAvailableTime);
            setTimeUntilNextClaim(formatTimeRemaining(status.nextAvailableTime - Math.floor(Date.now() / 1000)));
          }
        } else {
          toast.error("Failed to claim bundle. Please try again.");
          updateStepStatus('claim-ubi', 'error', "Failed to claim data bundle");
        }
      }
    } catch (error) {
      console.error("Error claiming bundle:", error);
      toast.error("Error during claim. Please try again.");
      updateStepStatus('claim-ubi', 'error', "Error during claim process");
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if all steps are completed or if there's an error
  const allStepsCompleted = transactionSteps.every(step => step.status === 'success');
  const hasError = transactionSteps.some(step => step.status === 'error');

  const contextValue: FreeClaimContextType = {
    isWhitelisted,
    hasAttested,
    canClaim,
    timeUntilNextClaim,
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
      {children}      {/* Multi-step Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={(open: boolean) => !isWaitingTx && !open && closeTransactionDialog()}>
        <DialogContent className="sm:max-w-md border rounded-lg">
          <DialogHeader>
            <DialogTitle className='text-black/90 dark:text-white/90'>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              {currentOperation === 'data' && "Complete the steps below to claim your free data bundle."}
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