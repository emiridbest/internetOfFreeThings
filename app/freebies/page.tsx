"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Info, CheckCircle } from 'lucide-react';
import CountrySelector from '@/components/CountrySelector';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useFreebiesLogic } from '@/hooks/useFreebies';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';

// Create a component for the form content to wrap in Suspense
function FreebiesFormContent() {
    const {
        form,
        watchNetwork,
        operatorRange,
        amountValidation,
        isConnected,
        isProcessing,
        isClaiming,
        isLoading,
        networks,
        onSubmit,
    } = useFreebiesLogic();
    const router = useRouter();

    return (
        <div className="container py-8 bg-gradient-to-br from-green-50 to-white dark:from-black/90 dark:to-black min-h-screen">
            <p className="text-center mb-8 text-xl font-semibold text-black dark:text-green-100 bg-green-200 dark:bg-green-900/30 py-3 px-6 rounded-full mx-auto max-w-2xl shadow-lg">
                🎁 Get FREE Airtime - No Payment Required! 🎁
            </p>

            <div className="max-w-md mx-auto">
                <Card className="bg-white dark:bg-black border-2 border-green-400 dark:border-green-500 shadow-2xl shadow-green-500/20 dark:shadow-green-500/30">
                    <CardHeader className="bg-gradient-to-r from-green-400 to-green-500 dark:from-green-600 dark:to-green-700 text-black dark:text-white rounded-t-lg">
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            📞 Free Airtime
                        </CardTitle>
                        <CardDescription className="text-black/80 dark:text-green-100 font-medium">
                            💰 50-60 NGN Free Airtime - No Limits!
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 bg-white dark:bg-black p-6">
                        {isProcessing ? (
                            <div className="flex flex-col items-center py-8 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400 mb-3" />
                                <span className="text-green-800 dark:text-green-300 font-semibold text-center">Processing your free airtime...</span>
                                <p className="text-sm text-green-700 dark:text-green-400 mt-2 text-center max-w-xs">
                                    Please wait while we verify your information and process your free airtime. This may take a few moments.
                                </p>
                            </div>
                        ) : !isConnected ? (
                            <div className="text-center py-4 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-black rounded-lg border border-green-300 dark:border-green-700">
                                <p className="mb-4 text-black dark:text-green-100 font-medium">
                                    🔗 Connect your wallet to claim your free airtime
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="text-center bg-gradient-to-r from-green-200 to-green-300 dark:from-green-800 dark:to-green-900 rounded-lg p-4 border-2 border-green-400 dark:border-green-600">
                                    <p className="text-black dark:text-green-100 font-bold text-lg mb-2">
                                        🎉 Claim FREE Airtime - No Payment Needed! 🎉
                                    </p>
                                    <p className="text-sm text-black/80 dark:text-green-200">
                                        Get 50-60 NGN worth of airtime absolutely free!
                                    </p>
                                    <p className="text-xs text-black/80 dark:text-green-200">
                                        All transaction are sponsored on the Lisk network!
                                    <p onClick={()=>router.push(`https://t.me/+tTNxqnxh5TpjNGE0`)} className="text-xs text-black/80 dark:text-green-200 mt-2 cursor-pointer">
                                        If you need funds to complete the transaction, please join our Telegram group for assistance.
                                    </p>
                                        </p>
                                </div>

                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="network"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-black/80 dark:text-green-400 font-medium text-sm">Network Provider</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || networks.length === 0}>
                                                        <FormControl className="relative">
                                                            <SelectTrigger className="bg-white dark:bg-black/90 border-2 border-black/70 hover:border-green-500 focus:border-green-400 dark:focus:border-green-400 focus:ring-2 focus:ring-green-400/20 dark:focus:ring-green-400/30 transition-all duration-200 text-black/90 dark:text-white/90">
                                                                <SelectValue placeholder="Select network provider" className='text-xs'>
                                                                    {field.value && networks && networks.length > 0 && (() => {
                                                                        const selectedNetwork = networks.find(n => n.id === field.value);
                                                                        if (selectedNetwork && selectedNetwork.logoUrls && selectedNetwork.logoUrls.length > 0) {
                                                                            return (
                                                                                <div className="flex items-center">
                                                                                    <img
                                                                                        src={selectedNetwork.logoUrls[0]}
                                                                                        alt={selectedNetwork.name}
                                                                                        className="h-4 w-4 mr-2 rounded-sm object-contain"
                                                                                        onError={(e) => {
                                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                                        }}
                                                                                    />
                                                                                    <span>{selectedNetwork.name}</span>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return field.value ? field.value : "Select network provider";
                                                                    })()}
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-white dark:bg-black/90 border-2 dark:border-green-400/40">
                                                            {networks.length > 0 ? (
                                                                networks.map((network) => (
                                                                    <SelectItem
                                                                        key={network.id}
                                                                        value={network.id}
                                                                        className="hover:bg-green-50 dark:hover:bg-green-900/20 focus:bg-green-600 dark:focus:bg-green-800/30 text-black/90 dark:text-white/90"
                                                                    >
                                                                        <div className="flex items-center">
                                                                            {network.logoUrls && network.logoUrls.length > 0 && (
                                                                                <img
                                                                                    src={network.logoUrls[0]}
                                                                                    alt={network.name}
                                                                                    className="h-5 w-5 mr-2 rounded-sm object-contain"
                                                                                    onError={(e) => {
                                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                                    }}
                                                                                />
                                                                            )}
                                                                            <span>{network.name}</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <div className="px-2 py-1 text-sm text-black/90 dark:text-white/90">
                                                                    No network providers available
                                                                </div>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    {isLoading && <div className="text-sm text-black/60 dark:text-green-300 mt-1 flex items-center">
                                                        <Loader2 className="h-3 w-3 animate-spin mr-1 text-green-600 dark:text-green-400" /> Loading providers...
                                                    </div>}
                                                    <FormMessage className="text-red-600 dark:text-red-400" />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="phoneNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-black/80 dark:text-green-400 font-medium text-sm">Phone Number</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Enter phone number"
                                                            {...field}
                                                            className="text-xs bg-white dark:bg-black/90 border-2 border-black/70 hover:border-green-500 focus:border-green-400 dark:focus:border-green-400 focus:ring-2 focus:ring-green-400/20 dark:focus:ring-green-400/30 placeholder:text-black/50 dark:placeholder:text-white/40 text-black/90 dark:text-white/90 transition-all duration-200"
                                                        />
                                                    </FormControl>
                                                    <FormDescription className="text-xs text-black/60 dark:text-white/30">
                                                        Enter the phone number to receive free airtime.
                                                    </FormDescription>
                                                    <FormMessage className="text-red-600 dark:text-red-400" />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="amount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-black/80 dark:text-green-400 font-medium text-sm">
                                                        Free Airtime Amount {operatorRange && `(${operatorRange.currency})`}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                placeholder={operatorRange ? `Enter amount (${operatorRange.min} - ${operatorRange.max})` : "Enter amount"}
                                                                {...field}
                                                                className={`text-xs bg-white dark:bg-black/80 border-2 ${!amountValidation.isValid
                                                                    ? 'border-red-400 dark:border-red-400'
                                                                    : amountValidation.type === 'warning'
                                                                        ? 'border-yellow-400 dark:border-yellow-400'
                                                                        : amountValidation.type === 'info'
                                                                            ? 'border-blue-400 dark:border-blue-400'
                                                                            : amountValidation.type === 'success'
                                                                                ? 'border-green-400 dark:border-green-400'
                                                                                : 'border-black/70'
                                                                    } hover:border-green-500 focus:border-green-400 dark:focus:border-green-400 focus:ring-2 focus:ring-green-400/20 dark:focus:ring-green-400/30 placeholder:text-gray-500 dark:placeholder:text-gray-400 text-gray-900 dark:text-white transition-all duration-200`}
                                                                disabled={isLoading || !operatorRange}
                                                            />
                                                            {amountValidation.message && (
                                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                                    {amountValidation.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                                                    {amountValidation.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                                                                    {amountValidation.type === 'info' && <Info className="h-4 w-4 text-blue-500" />}
                                                                    {amountValidation.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </FormControl>

                                                    {/* Amount validation message */}
                                                    {amountValidation.message && (
                                                        <div className={`text-xs mt-1 flex items-center ${amountValidation.type === 'error'
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : amountValidation.type === 'warning'
                                                                ? 'text-yellow-600 dark:text-yellow-400'
                                                                : amountValidation.type === 'info'
                                                                    ? 'text-blue-600 dark:text-blue-400'
                                                                    : 'text-green-600 dark:text-green-400'
                                                            }`}>
                                                            {amountValidation.message}
                                                        </div>
                                                    )}

                                                    {/* Loading state */}
                                                    {isLoading && watchNetwork && (
                                                        <div className="text-sm text-black/60 dark:text-green-300 mt-1 flex items-center">
                                                            <Loader2 className="h-3 w-3 animate-spin mr-1 text-green-600 dark:text-green-400" /> Loading amount limits...
                                                        </div>
                                                    )}

                                                    {/* No range available */}
                                                    {!isLoading && watchNetwork && !operatorRange && (
                                                        <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                            No amount limits available for this network
                                                        </div>
                                                    )}

                                                    <FormMessage className="text-red-600 dark:text-red-400" />
                                                </FormItem>
                                            )}
                                        />
                                    </form>
                                </Form>
                            </>
                        )}
                    </CardContent>

                    <CardFooter className="bg-gradient-to-r from-yellow-400 to-yellow-500 dark:from-yellow-600 dark:to-yellow-700 rounded-b-lg">
                        <Button
                            className="w-full bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-yellow-400 dark:text-black font-bold text-lg py-6 border-2 border-yellow-300 dark:border-black shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                            disabled={isClaiming || isProcessing || !form.watch("phoneNumber") || form.watch("phoneNumber").length < 5}
                            onClick={form.handleSubmit(onSubmit)}
                        >
                            {isClaiming || isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Claiming...
                                </>
                            ) : (
                                '🎁 Claim Free Airtime 🎁'
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}


// Main component with Suspense boundary
export default function Freebies() {
    const { authenticated, user } = usePrivy();
    const router = useRouter();

    // Redirect to login page if not authenticated
    useEffect(() => {
        if (!authenticated) {
            router.push('/');
        }
    }, [authenticated, router]);

    return (
        <Suspense fallback={
            <div className="container py-8 flex items-center justify-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-yellow-700 dark:text-yellow-400">
                        Loading freebies...
                    </p>
                </div>
            </div>
        }>
            <FreebiesFormContent />
        </Suspense>
    );
}