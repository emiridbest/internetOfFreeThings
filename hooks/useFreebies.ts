import { useState, useEffect } from 'react';
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

// Updated form schema - removed paymentToken since it's free
const formSchema = z.object({
  country: z.string({
    required_error: "Please select a country.",
  }),
  phoneNumber: z.string()
    .min(10, { message: "Phone number must be at least 10 digits." })
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
  email: z.string().email({
    message: "Invalid email address.",
  })
});

interface OperatorRange {
  min: number;
  max: number;
  currency?: string;
}

export const useFreebiesLogic = () => {
    const { user, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const [address, setAddress] = useState<string | null>(null);
    const isConnected = authenticated && !!address;

    useEffect(() => {
        const getWalletAddress = async () => {
            const embeddedWallet = wallets?.find((wallet) => wallet.walletClientType === 'privy');
            if (embeddedWallet) {
                try {
                    const walletAddress = await embeddedWallet.address;
                    setAddress(walletAddress);
                } catch (error) {
                    console.error("Error getting wallet address:", error);
                }
            }
        };

        if (authenticated && wallets?.length > 0) {
            getWalletAddress();
        }
    }, [authenticated, wallets]);

    const {
        transactionSteps,
        updateStepStatus,
        openTransactionDialog,
        isProcessing,
        handleClaim,
        handleWhitelist,
        handleAttest,
    } = useFreeClaimProcessor();

    // State variables
    const [isClaiming, setIsClaiming] = useState(false);
    const [networkId, setNetworkId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState<boolean>(false);
    const [isVerified, setIsVerified] = useState<boolean>(false);
    const [selectedPrice, setSelectedPrice] = useState(0);
    const [networks, setNetworks] = useState<AirtimeOperator[]>([]);
    const [countryCurrency, setCountryCurrency] = useState<string>("");
    const [operatorRange, setOperatorRange] = useState<OperatorRange | null>(null);

    const [amountValidation, setAmountValidation] = useState<{
        isValid: boolean;
        message: string;
        type: 'error' | 'warning' | 'success' | 'info';
    }>({ isValid: true, message: '', type: 'success' });
  
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            country: "ng", // Default to Nigeria
            phoneNumber: "",
            network: "",
            amount: "",
            email: "",
        },
    });

    const watchNetwork = form.watch("network");
    const watchAmount = form.watch("amount");

    // Fetch network providers when country changes
    useEffect(() => {
        const getNetworks = async () => {
            setIsLoading(true);
            try {
                form.setValue("network", "");
                form.setValue("amount", "");
                setOperatorRange(null);

                const operators = await fetchAirtimeOperators("ng");
                console.log("Fetched Airtime Operators:", operators);
                setNetworks(operators);
            } catch (error) {
                console.error("Error fetching airtime operators:", error);
                toast.error("Failed to load network providers. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        getNetworks();
    }, []);

    // Set operator range when network changes - fixed to 50-60 NGN
    useEffect(() => {
        const getOperatorRange = async () => {
            if (!watchNetwork) {
                setOperatorRange(null);
                return;
            }

            setIsLoading(true);
            form.setValue("amount", "50"); // Default to minimum amount

            try {
                // Fixed range for free airtime: 50-60 NGN
                setOperatorRange({
                    min: 50,
                    max: 60,
                    currency: "NGN"
                });
            } catch (error) {
                console.error("Error setting operator range:", error);
                toast.error("Failed to load amount limits. Please try again.");
                setOperatorRange(null);
            } finally {
                setIsLoading(false);
            }
        };

        getOperatorRange();
    }, [watchNetwork]);

    // Validate amount against operator range
    useEffect(() => {
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

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (isProcessing || isClaiming) {
            console.log("Already processing, ignoring duplicate submission");
            return;
        }

        const transactionId = `${address}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setIsClaiming(true);

        try {
            // Step 1: Whitelist if not whitelisted
            updateStepStatus('whitelist', 'loading');
            try {
                await handleWhitelist();
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (whitelistError) {
                console.error("Whitelist error:", whitelistError);
                return;
            }

            // Step 2: Attest if not attested
            updateStepStatus('attestation', 'loading');
            try {
                await handleAttest();
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (attestError) {
                console.error("Attestation error:", attestError);
                return;
            }

            // Step 3: Claim bundle (this validates eligibility)
            updateStepStatus('claim-ubi', 'loading');
            try {
                await handleClaim();
                updateStepStatus('claim-ubi', 'success');
            } catch (claimError) {
                console.error("Claim failed:", claimError);
                updateStepStatus('claim-ubi', 'error', "An error occurred during the claim process");
                return;
            }

            // Validate amount one more time before submission
            const enteredAmount = parseFloat(values.amount);
            if (!operatorRange) {
                toast.error("Please select a network provider first.");
                return;
            }
            if (enteredAmount < operatorRange.min || enteredAmount > operatorRange.max) {
                toast.error(`Amount must be between ${operatorRange.min} and ${operatorRange.max} ${operatorRange.currency}`);
                return;
            }

            // Phone number verification
            setIsVerifying(true);
            try {
                const phoneNumber = values.phoneNumber;
                const country = values.country;
                const provider = values.network;
                
                if (!phoneNumber || !country || !provider) {
                    toast.error("Please ensure all fields are filled out correctly.");
                    throw new Error("Please ensure all fields are filled out correctly.");
                }
                
                openTransactionDialog("airtime", values.phoneNumber);
                updateStepStatus('verify-phone', 'loading');

                const verificationResult = await verifyAndSwitchProvider(phoneNumber, provider, country);

                if (verificationResult.verified) {
                    setIsVerified(true);
                    toast.success("Phone number verified successfully");

                    if (verificationResult.autoSwitched && verificationResult.correctProviderId) {
                        form.setValue('network', verificationResult.correctProviderId);
                        toast.success(verificationResult.message);
                    } else {
                        toast.success("You are using the correct network provider.");
                        updateStepStatus('verify-phone', 'success');
                    }
                } else {
                    setIsVerified(false);
                    toast.error("Phone number verification failed. Please double-check the phone number.");
                    updateStepStatus('verify-phone', 'error', "Your phone number did not verify with the selected network provider. Please check the number and try again.");
                    return;
                }
            } catch (error) {
                console.error("Error during verification:", error);
                return;
            } finally {
                setIsVerifying(false);
            }

            // Skip payment steps since it's free - go directly to top-up
            const networkName = networks.find(net => net.id === values.network)?.name || '';
            
            // Skip balance check and payment steps
            updateStepStatus('check-balance', 'success');
            updateStepStatus('send-payment', 'success');

            toast.success("Processing your free airtime top-up...");

            // Process the free airtime top-up
            updateStepStatus('top-up', 'loading');

            try {
                const cleanPhoneNumber = values.phoneNumber.replace(/[\s\-\+]/g, '');

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
                            country: values.country,
                            phoneNumber: cleanPhoneNumber
                        },
                        email: values.email,
                        type: 'airtime',
                        isFreeClaim: true // Flag to indicate this is a free claim
                    }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    toast.success(`Successfully topped up ${values.phoneNumber} with ${enteredAmount} ${operatorRange.currency} free airtime! 🎉`);
                    updateStepStatus('top-up', 'success');

                    // Reset the form but keep some values
                    form.reset({
                        country: "ng",
                        phoneNumber: "",
                        network: "",
                        amount: "",
                        email: values.email,
                    });
                    setSelectedPrice(0);
                } else {
                    console.error("Top-up API Error:", data);
                    toast.error(data.error || "There was an issue processing your free airtime. Our team has been notified.");
                    updateStepStatus('top-up', 'error', "Free airtime processing failed. Please try again or contact support.");
                }
            } catch (error) {
                console.error("Error during free airtime top-up:", error);
                toast.error("There was an error processing your free airtime. Our team has been notified and will resolve this shortly.");
                updateStepStatus('top-up', 'error', "Free airtime processing failed. Please try again or contact support.");
            }

        } catch (error) {
            console.error("Error in submission flow:", error);
            toast.error(error instanceof Error ? error.message : "There was an unexpected error processing your request.");
            const loadingStepIndex = transactionSteps.findIndex(step => step.status === 'loading');
            if (loadingStepIndex !== -1) {
                updateStepStatus(
                    transactionSteps[loadingStepIndex].id,
                    'error',
                    error instanceof Error ? error.message : 'Unknown error'
                );
            }
        } finally {
            setIsClaiming(false);
        }
    }

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
        setCountryCurrency,
        onSubmit,
        handleWhitelist,
        handleAttest,
        handleClaim
    };
};