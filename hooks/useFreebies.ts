import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFreeClaimProcessor } from '../context/FreeClaimProvider';

import {
    fetchAirtimeOperators,
    verifyAndSwitchProvider,
    type AirtimeOperator,
} from '@/services/utility/utilityServices';

// Constants
const COUNTRY_CODE = "ng" as const;
const FREE_AIRTIME_RANGE = {
    min: 50,
    max: 60,
    currency: "NGN"
} as const;
const ASYNC_DELAY = 1000; // Delay between async operations
const PHONE_NUMBER_MIN_LENGTH = 10;

// Updated form schema
const formSchema = z.object({
    phoneNumber: z.string()
        .min(PHONE_NUMBER_MIN_LENGTH, { message: `Phone number must be at least ${PHONE_NUMBER_MIN_LENGTH} digits.` })
        .refine(val => /^\d+$/.test(val.replace(/[\s-]/g, '')), {
            message: "Phone number should contain only digits, spaces, or hyphens."
        }),
    network: z.string({
        required_error: "Please select a network provider.",
    }),
    amount: z.string()
        .min(1, { message: "Please enter an amount." })
        .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
            message: "Amount must be a valid positive number."
        }),
});

interface OperatorRange {
    min: number;
    max: number;
    currency: string;
}

interface AmountValidation {
    isValid: boolean;
    message: string;
    type: 'error' | 'warning' | 'success' | 'info';
}

// Custom error classes for better error handling
class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

export const useFreebiesLogic = () => {
    const { user, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const abortControllerRef = useRef<AbortController | null>(null);

    // Wallet state
    const [address, setAddress] = useState<string | null>(null);
    const isConnected = authenticated && !!address;

    // Transaction states
    const [isClaiming, setIsClaiming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    // Data states
    const [networks, setNetworks] = useState<AirtimeOperator[]>([]);
    const [operatorRange, setOperatorRange] = useState<OperatorRange | null>(null);
    const [selectedPrice, setSelectedPrice] = useState(0);
    const [amountValidation, setAmountValidation] = useState<AmountValidation>({
        isValid: true,
        message: '',
        type: 'success'
    });

    const {
        transactionSteps,
        updateStepStatus,
        openTransactionDialog,
        closeTransactionDialog,
        isProcessing,
        handleClaim,
        handleWhitelist,
        handleAttest,
    } = useFreeClaimProcessor();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            phoneNumber: "",
            network: "",
            amount: "",
        },
    });

    const watchNetwork = form.watch("network");
    const watchAmount = form.watch("amount");

    // Utility functions
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const cleanPhoneNumber = useCallback((phoneNumber: string): string => {
        return phoneNumber.replace(/[\s\-\+]/g, '');
    }, []);

    const generateTransactionId = useCallback((address: string): string => {
        return `${address}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Wallet management
    const initializeWallet = useCallback(async () => {
        if (!authenticated || !wallets?.length) return;

        const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');
        if (!embeddedWallet) return;

        try {
            const walletAddress = await embeddedWallet.address;
            setAddress(walletAddress);
        } catch (error) {
            console.error("Error getting wallet address:", error);
            toast.error("Failed to connect wallet. Please try again.");
        }
    }, [authenticated, wallets]);

    // Network operations
    const fetchNetworkProviders = useCallback(async () => {
        // Cancel previous request if still pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        setIsLoading(true);

        try {
            // Reset form fields
            form.setValue("network", "");
            form.setValue("amount", "");
            setOperatorRange(null);

            const operators = await fetchAirtimeOperators(COUNTRY_CODE);

            if (abortControllerRef.current?.signal.aborted) return;

            console.log("Fetched Airtime Operators:", operators);
            setNetworks(operators);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;

            console.error("Error fetching airtime operators:", error);
            toast.error("Failed to load network providers. Please try again.");
            throw new NetworkError("Failed to fetch network providers");
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [form]);

    const setupOperatorRange = useCallback(async () => {
        if (!watchNetwork) {
            setOperatorRange(null);
            return;
        }

        setIsLoading(true);

        try {
            // Set fixed range for free airtime
            setOperatorRange(FREE_AIRTIME_RANGE);
            form.setValue("amount", FREE_AIRTIME_RANGE.min.toString());
        } catch (error) {
            console.error("Error setting operator range:", error);
            toast.error("Failed to load amount limits. Please try again.");
            setOperatorRange(null);
        } finally {
            setIsLoading(false);
        }
    }, [watchNetwork, form]);

    // Validation
    const validateAmount = useCallback(() => {
        if (!operatorRange) {
            setAmountValidation({ isValid: true, message: '', type: 'success' });
            setSelectedPrice(0);
            return;
        }

        const enteredAmount = parseFloat(watchAmount);

        if (isNaN(enteredAmount)) {
            setAmountValidation({
                isValid: false,
                message: 'Please enter a valid number',
                type: 'error'
            });
            setSelectedPrice(0);
            return;
        }

        if (enteredAmount < operatorRange.min) {
            setAmountValidation({
                isValid: false,
                message: `Minimum amount is ${operatorRange.min} ${operatorRange.currency}`,
                type: 'error'
            });
            setSelectedPrice(0);
        } else if (enteredAmount > operatorRange.max) {
            setAmountValidation({
                isValid: false,
                message: `Maximum amount is ${operatorRange.max} ${operatorRange.currency}`,
                type: 'error'
            });
            setSelectedPrice(0);
        } else {
            setAmountValidation({
                isValid: true,
                message: `Free airtime: ${enteredAmount} ${operatorRange.currency}`,
                type: 'success'
            });
            setSelectedPrice(enteredAmount);
        }
    }, [watchAmount, operatorRange]);

    // Phone verification
    const verifyPhoneNumber = useCallback(async (phoneNumber: string, provider: string) => {
        setIsVerifying(true);

        try {
            if (!phoneNumber || !provider) {
                throw new ValidationError("Please ensure all fields are filled out correctly.");
            }

            const verificationResult = await verifyAndSwitchProvider(phoneNumber, provider, COUNTRY_CODE);

            if (verificationResult.verified) {
                setIsVerified(true);
                toast.success("Phone number verified successfully");

                if (verificationResult.autoSwitched && verificationResult.correctProviderId) {
                    form.setValue('network', verificationResult.correctProviderId);
                    toast.success(verificationResult.message);
                } else {
                    toast.success("You are using the correct network provider.");
                }

                return true;
            } else {
                setIsVerified(false);
                toast.error("Phone number verification failed. Please double-check the phone number.");
                return false;
            }
        } catch (error) {
            console.error("Error during verification:", error);
            toast.error(error instanceof Error ? error.message : "Verification failed");
            return false;
        } finally {
            setIsVerifying(false);
        }
    }, [form]);

    // Transaction processing
    const processWhitelistStep = useCallback(async () => {
        try {
            await handleWhitelist();
            await delay(ASYNC_DELAY);
        } catch (error) {
            console.error("Whitelist error:", error);
        }
    }, [handleWhitelist]);

    const processAttestationStep = useCallback(async (values: z.infer<typeof formSchema>) => {
        try {
            await handleAttest();
            await delay(ASYNC_DELAY);

            // Verify phone number after attestation
            const verificationSuccess = await verifyPhoneNumber(values.phoneNumber, values.network);
            if (!verificationSuccess) {
                throw new ValidationError("Phone number verification failed");
            }
        } catch (error) {
            console.error("Attestation error:", error);
            throw error;
        }
    }, [handleAttest, verifyPhoneNumber]);

    const processClaimStep = useCallback(async () => {
        updateStepStatus('claim-ubi', 'loading');
        try {
            await handleClaim();
            updateStepStatus('claim-ubi', 'success');

        } catch (error) {
            console.error("Claim failed:", error);
            updateStepStatus('claim-ubi', 'error', "An error occurred during the claim process");
            return
        }
    }, [handleClaim, updateStepStatus]);

    const processAirtimeTopup = useCallback(async (values: z.infer<typeof formSchema>, enteredAmount: number) => {
        const networkName = networks.find(net => net.id === values.network)?.name || '';
        const cleanedPhoneNumber = cleanPhoneNumber(values.phoneNumber);

        toast.success("Processing your free airtime top-up...");

        try {
            const response = await fetch('/api/topup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    operatorId: values.network,
                    amount: enteredAmount.toString(),
                    useLocalAmount: true,
                    recipientPhone: {
                        country: COUNTRY_CODE,
                        phoneNumber: cleanedPhoneNumber
                    },
                    type: 'airtime',
                    isFreeClaim: true
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success(`Successfully topped up ${values.phoneNumber} with ${enteredAmount} ${operatorRange?.currency} free airtime! 🎉`);
                return true;
            } else {
                console.error("Top-up API Error:", data);
                toast.error(data.error || "There was an issue processing your free airtime. Our team has been notified.");
                return false;
            }
        } catch (error) {
            console.error("Error during free airtime top-up:", error);
            toast.error("There was an error processing your free airtime. Our team has been notified and will resolve this shortly.");
            throw error;
        }
    }, [networks, cleanPhoneNumber, operatorRange]);

    const resetFormAfterSuccess = useCallback(() => {
        form.reset({
            phoneNumber: "",
            network: "",
            amount: "",
        });
        setSelectedPrice(0);
        setIsVerified(false);
    }, [form]);

    // Main submission handler
    const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
        if (isProcessing || isClaiming) {
            console.log("Already processing, ignoring duplicate submission");
            return;
        }

        if (!address) {
            toast.error("Wallet not connected. Please connect your wallet first.");
            return;
        }

        // Final validation
        const enteredAmount = parseFloat(values.amount);
        if (!operatorRange) {
            toast.error("Please select a network provider first.");
            return;
        }

        if (enteredAmount < operatorRange.min || enteredAmount > operatorRange.max) {
            toast.error(`Amount must be between ${operatorRange.min} and ${operatorRange.max} ${operatorRange.currency}`);
            return;
        }

        const transactionId = generateTransactionId(address);
        setIsClaiming(true);
        openTransactionDialog("airtime", values.phoneNumber);

        try {
            // Step 1: Process whitelist
            await processWhitelistStep();

            // Step 2: Process attestation and verification
            await processAttestationStep(values);

            // Step 3: Process claim
            await processClaimStep();

        } catch (error) {
            console.error("Error in submission flow:", error);
            toast.error(error instanceof Error ? error.message : "There was an unexpected error processing your request.");
            // Update any loading step to error state
            throw error;
        }


        try {

            // Step 1: Process whitelist
            await processWhitelistStep();

            // Step 2: Process attestation and verification
            await processAttestationStep(values);

            // Step 3: Process claim
            await processClaimStep();
            toast.success("Claim processed successfully!");

            // Step 4: Process airtime top-up
            const topupSuccess = await processAirtimeTopup(values, enteredAmount);

            if (topupSuccess) {
                closeTransactionDialog();
                resetFormAfterSuccess();
            }

        } catch (error) {
            console.error("Error in submission flow:", error);
            toast.error(error instanceof Error ? error.message : "There was an unexpected error processing your request.");

            // Update any loading step to error state
            const loadingStepIndex = transactionSteps.findIndex(step => step.status === 'loading');
            if (loadingStepIndex !== -1) {
                updateStepStatus(
                    transactionSteps[loadingStepIndex].id,
                    'error',
                    error instanceof Error ? error.message : 'Unknown error'
                );
            }
            throw error;
        } finally {
            setIsClaiming(false);
        }
    }, [
        isProcessing,
        isClaiming,
        address,
        operatorRange,
        generateTransactionId,
        openTransactionDialog,
        processWhitelistStep,
        processAttestationStep,
        processClaimStep,
        processAirtimeTopup,
        closeTransactionDialog,
        resetFormAfterSuccess,
        transactionSteps,
        updateStepStatus
    ]);

    // Effects
    useEffect(() => {
        initializeWallet();
    }, [initializeWallet]);

    useEffect(() => {
        fetchNetworkProviders();

        // Cleanup function
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [fetchNetworkProviders]);

    useEffect(() => {
        setupOperatorRange();
    }, [setupOperatorRange]);

    useEffect(() => {
        validateAmount();
    }, [validateAmount]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        // Form and validation
        form,
        formSchema,
        watchNetwork,
        operatorRange,
        amountValidation,

        // State
        isConnected,
        isProcessing,
        isClaiming,
        isLoading,
        isVerifying,
        isVerified,
        selectedPrice,

        // Data
        networks,

        // Functions
        onSubmit,
        handleWhitelist,
        handleAttest,
        handleClaim,

        // Utility functions (exposed for testing or external use)
        cleanPhoneNumber,
        generateTransactionId,
    };
};