// hooks/useFreebiesLogic.js
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    fetchDataPlans,
    verifyAndSwitchProvider,
    type NetworkOperator,
    type DataPlan
} from '../services/utility/utilityServices';
import { useFreeClaimProcessor } from '../context/FreeClaimProvider'; // Updated import

const formSchema = z.object({
    country: z.string({
        required_error: "Please select a country.",
    }),
    phoneNumber: z.string()
        .min(5, { message: "Phone number must be at least 5 digits." })
        .refine(val => /^\d+$/.test(val.replace(/[\s-]/g, '')), {
            message: "Phone number should contain only digits, spaces, or hyphens."
        }),
    network: z.string({
        required_error: "Please select a network provider.",
    }),
    plan: z.string({
        required_error: "Please select a data plan.",
    }),
    paymentToken: z.string({
        required_error: "Please select a payment token.",
    }),
    email: z.string().email({
        message: "Invalid email address.",
    })
});

export const useFreebiesLogic = () => {
    const { address, isConnected } = useAccount();
    
    // Updated to use the correct context hook
    const {
        updateStepStatus,
        openTransactionDialog,
        isProcessing,
        handleClaim,
        handleWhitelist,
        handleAttest,
        isWhitelisted: contractIsWhitelisted,
        hasAttested: contractHasAttested,
        canClaim: contractCanClaim,
        timeUntilNextClaim: contractTimeRemaining,
        // Note: processDataTopUp and processPayment might need to be added to the context
        // or implemented separately
    } = useFreeClaimProcessor();

    // State variables
    const [isClaiming, setIsClaiming] = useState(false);
    const [networkId, setNetworkId] = useState("");
    const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
    const [availablePlans, setAvailablePlans] = useState<DataPlan[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<string>(contractTimeRemaining || "");
    const [nextClaimTime, setNextClaimTime] = useState<Date | null>(null);
    const [networks, setNetworks] = useState<NetworkOperator[]>([]);
    const [canClaimToday, setCanClaimToday] = useState<boolean>(contractCanClaim || true);
    const [isVerifying, setIsVerifying] = useState<boolean>(false);
    const [isVerified, setIsVerified] = useState<boolean>(false);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | undefined>(contractIsWhitelisted);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            country: "",
            phoneNumber: "",
            network: "",
            plan: "",
            email: "",
            paymentToken: "",
        },
    });

    const watchCountry = form.watch("country");
    const watchNetwork = form.watch("network");

    // Sync with contract time remaining
    useEffect(() => {
        setTimeRemaining(contractTimeRemaining || "");
    }, [contractTimeRemaining]);

    // Sync with contract states
    useEffect(() => {
        setIsWhitelisted(contractIsWhitelisted);
        setCanClaimToday(contractCanClaim || true);
    }, [contractIsWhitelisted, contractCanClaim]);

    // Function to set country currency
    const setCountryCurrency = (country: string) => {
        console.log("Setting country currency for:", country);
    };

    // Fetch network providers when country changes
    useEffect(() => {
        const getNetworks = async () => {
            if (watchCountry) {
                setIsLoading(true);
                form.setValue("network", "");
                form.setValue("plan", "");

                try {
                    const response = await fetch(`/api/utilities/data/free?country=${watchCountry}`, {
                        method: 'GET'
                    });
                    if (!response.ok) {
                        throw new Error(`Failed to fetch data plans: ${response.statusText}`);
                    }

                    const operators: NetworkOperator[] = await response.json();
                    // Filter out MTN Nigeria extra data
                    const filteredOperators = operators.filter(operator => 
                        !(operator.name.toLowerCase().includes('mtn nigeria extra data') ||
                        (operator.name.toLowerCase().includes('smile uganda data')))
                    );
                    setNetworks(filteredOperators);
                } catch (error) {
                    console.error("Error fetching mobile operators:", error);
                    toast.error("Failed to load network providers. Please try again.");
                } finally {
                    setIsLoading(false);
                }
            }
        };

        getNetworks();
    }, [watchCountry, form]);

    // Fetch data plans when network changes
    useEffect(() => {
        const getDataPlans = async () => {
            if (watchNetwork && watchCountry) {
                setIsLoading(true);
                form.setValue("plan", "");

                try {
                    const plans = await fetchDataPlans(watchNetwork, watchCountry);
                    setAvailablePlans([plans[0]]);
                    setSelectedPlan(plans[0]);
                    setNetworkId(watchNetwork);
                } catch (error) {
                    console.error("Error fetching data plans:", error);
                    toast.error("Failed to load data plans. Please try again.");
                } finally {
                    setIsLoading(false);
                }
            } else {
                setAvailablePlans([]);
            }
        };

        getDataPlans();
    }, [watchNetwork, watchCountry, form]);

    // Local claim check (12-hour cooldown) - separate from contract cooldown
    useEffect(() => {
        const checkLastClaim = () => {
            if (typeof window === 'undefined') return true;
            
            const lastClaim = localStorage.getItem('lastFreeClaim');
            if (!lastClaim) return true;
            
            const lastClaimTime = new Date(lastClaim);
            const now = new Date();
            const timeDiff = now.getTime() - lastClaimTime.getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            // 12-hour cooldown
            if (hoursDiff < 12) {
                const nextClaim = new Date(lastClaimTime.getTime() + (12 * 60 * 60 * 1000));
                setNextClaimTime(nextClaim);
                return false;
            }
            return true;
        };

        const canClaimLocally = checkLastClaim();
        setCanClaimToday(canClaimLocally && contractCanClaim);
    }, [contractCanClaim]);

    // Timer for countdown
    useEffect(() => {
        if (!nextClaimTime) return;

        const timer = setInterval(() => {
            const now = new Date();
            const diff = nextClaimTime.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeRemaining("Available now!");
                setCanClaimToday(contractCanClaim);
                setNextClaimTime(null);
                clearInterval(timer);
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [nextClaimTime, contractCanClaim]);

    // Placeholder functions for data processing (you'll need to implement these or add to context)
    const processDataTopUp = async (
        data: { phoneNumber: string; country: string; network: string; email: string; transactionId: string },
        price: number,
        plans: DataPlan[],
        networks: { id: string; name: string }[]
    ) => {
        // This should be implemented in your context or as a separate service
        console.log("Processing data top-up:", { data, price, plans, networks });
        // Placeholder - replace with actual implementation
        return { success: true };
    };

    // Handle claim bundle logic - Updated to work with FreeClaimProvider
    async function onSubmit(values: z.infer<typeof formSchema>) {
        // Early return if already processing to prevent race conditions
        if (isProcessing || isClaiming || !canClaimToday) {
            console.log("Already processing, ignoring duplicate submission");
            return;
        }

        // Check localStorage before starting process
        const checkCanClaim = () => {
            if (typeof window === 'undefined') return true; // SSR check
            const lastClaim = localStorage.getItem('lastFreeClaim');
            if (!lastClaim) return true;
            
            const lastClaimTime = new Date(lastClaim);
            const now = new Date();
            const timeDiff = now.getTime() - lastClaimTime.getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            return hoursDiff >= 12; // 12-hour cooldown
        };

        if (!checkCanClaim()) {
            toast.error("You have already claimed your free data bundle recently. Please wait 12 hours between claims.");
            return;
        }

        // Generate unique transaction ID for idempotency
        const transactionId = `${address}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        setIsClaiming(true);
        let hasClaimedSuccessfully = false;
        
        try {
            const phoneNumber = values.phoneNumber;
            const country = values.country;
            const emailAddress = values.email;
            const networkId = values.network;
            const selectedPlan = availablePlans.find(plan => plan.id === values.plan) || null;

            // Validation checks
            if (!isConnected) {
                toast.error("Please connect your wallet");
                return;
            }
            
            if (!selectedPlan) {
                toast.error("Please select a data plan");
                return;
            }
            
            if (!phoneNumber) {
                toast.error("Please enter your phone number");
                return;
            }

            // Validate selectedPlan has required properties
            if (!selectedPlan.price || typeof selectedPlan.price !== 'string') {
                toast.error("Invalid data plan selected. Please try selecting a different plan.");
                return;
            }

            // Set early localStorage to prevent rapid duplicate submissions
            if (typeof window !== 'undefined') {
                localStorage.setItem('processingClaim', transactionId);
            }

            setIsVerifying(true);

            try {
                // Open the transaction dialog with proper steps
                openTransactionDialog('data', phoneNumber);
                
                // Initialize transaction steps for the free claim process
                updateStepStatus('verify-phone', 'loading');
                
                const verificationResult = await verifyAndSwitchProvider(phoneNumber, networkId, country);

                if (!verificationResult || !verificationResult.verified) {
                    setIsVerified(false);
                    toast.error("Phone number verification failed. Please double-check the phone number.");
                    updateStepStatus('verify-phone', 'error', "Your phone number did not verify with the selected network provider. Please check the number and try again.");
                    return;
                }

                setIsVerified(true);
                toast.success("Phone number verified successfully");
                updateStepStatus('verify-phone', 'success');
                
                if (verificationResult.autoSwitched && verificationResult.correctProviderId) {
                    form.setValue('network', verificationResult.correctProviderId);
                    toast.success(verificationResult.message || "Network provider switched successfully");

                    try {
                        const plans = await fetchDataPlans(verificationResult.correctProviderId, country);
                        if (plans && plans.length > 0) {
                            setAvailablePlans(plans);
                            setSelectedPlan(plans[0]);
                        } else {
                            throw new Error("No data plans available for the correct provider");
                        }
                    } catch (planError) {
                        console.error("Error fetching new plans after provider switch:", planError);
                        toast.error("Failed to load plans for the correct provider. Please try again.");
                        return;
                    }
                }
                
                // Step 1: Whitelist if not whitelisted
                if (!contractIsWhitelisted) {
                    updateStepStatus('whitelist', 'loading');
                    try {
                        await handleWhitelist();
                        // Wait a moment for the state to update
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (whitelistError) {
                        console.error("Whitelist error:", whitelistError);
                        return;
                    }
                }
                
                // Step 2: Attest if not attested
                if (!contractHasAttested) {
                    updateStepStatus('attestation', 'loading');
                    try {
                        await handleAttest();
                        // Wait a moment for the state to update
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (attestError) {
                        console.error("Attestation error:", attestError);
                        return;
                    }
                }

                // Step 3: Claim bundle
                updateStepStatus('claim-ubi', 'loading');
                try {
                    await handleClaim();
                    hasClaimedSuccessfully = true;
                    updateStepStatus('claim-ubi', 'success');
                } catch (claimError) {
                    console.error("Claim failed:", claimError);
                    updateStepStatus('claim-ubi', 'error', "An error occurred during the claim process");
                    return;
                }

                // Process data top-up
                try {
                    const selectedPrice = parseFloat(selectedPlan.price.replace(/[^0-9.]/g, ''));
                    
                    // Validate parsed price
                    if (isNaN(selectedPrice) || selectedPrice <= 0) {
                        throw new Error("Invalid plan price");
                    }

                    const networks = [{ id: networkId, name: 'Network' }];
                    updateStepStatus('top-up', 'loading');
                    
                    const topupResult = await processDataTopUp(
                        {
                            phoneNumber,
                            country,
                            network: networkId,
                            email: emailAddress,
                            transactionId
                        },
                        selectedPrice,
                        availablePlans,
                        networks
                    );

                    if (topupResult && topupResult.success) {
                        // Only set localStorage after successful topup
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('lastFreeClaim', new Date().toISOString());
                            localStorage.removeItem('processingClaim');
                        }
                        
                        setCanClaimToday(false);
                        setSelectedPlan(null);
                        updateStepStatus('top-up', 'success');
                        form.reset();
                        toast.success("Data bundle topped up successfully! You can claim again in 12 hours.", {
                            duration: 10000,
                            description: "Your mobile data will be credited shortly"
                        });
                        
                        // Set next claim time
                        const nextClaim = new Date();
                        nextClaim.setHours(nextClaim.getHours() + 12);
                        setNextClaimTime(nextClaim);
                    } else {
                        throw new Error("Top-up failed - no success confirmation received");
                    }
                } catch (topupError) {
                    console.error("Top-up failed:", topupError);
                    toast.error("Failed to top up your data bundle. Please try again.");
                    updateStepStatus('top-up', 'error', "An error occurred during the top-up process.");
                    
                    if (hasClaimedSuccessfully) {
                        toast.error("Claim succeeded but top-up failed. Please contact support.");
                    }
                    
                    throw topupError;
                }

            } catch (verificationError) {
                console.error("Error during verification:", verificationError);
                toast.error(verificationError instanceof Error ? verificationError.message : "There was an unexpected error during verification.");
                updateStepStatus('verify-phone', 'error', "Verification failed. Please try again.");
                return;
            } finally {
                setIsVerifying(false);
            }
        } catch (error) {
            console.error("Error in submission flow:", error);
            
            // Clean up localStorage on any error
            if (typeof window !== 'undefined') {
                localStorage.removeItem('processingClaim');
                if (!hasClaimedSuccessfully) {
                    localStorage.removeItem('lastFreeClaim');
                }
            }
            
            const errorMessage = error instanceof Error ? error.message : "There was an unexpected error processing your request.";
            toast.error(errorMessage);
            
        } finally {
            // Always clean up states
            setIsClaiming(false);
            setIsVerifying(false);
            
            // Clean up processing flag
            if (typeof window !== 'undefined') {
                localStorage.removeItem('processingClaim');
                
                if (!hasClaimedSuccessfully) {
                    setTimeout(() => {
                        toast.info("You can try claiming again. If problems persist, please check your connection and wallet balance.", {
                            duration: 8000,
                        });
                    }, 2000);
                }
            }
        }
    }

    return {
        // Form and validation
        form,
        formSchema,
        watchCountry,
        watchNetwork,

        // State
        isConnected,
        isProcessing,
        isClaiming,
        isLoading,
        isVerifying,
        isVerified,
        isWhitelisted,
        canClaimToday,
        timeRemaining,
        contractHasAttested,

        // Data
        networks,
        availablePlans,
        selectedPlan,

        // Functions
        setCountryCurrency,
        onSubmit,
        handleWhitelist,
        handleAttest, 
        handleClaim
    };
};