"use client";

import React from 'react';
import { Loader2, Check, AlertCircle } from "lucide-react";

interface ClaimStatusDisplayProps {
    isLoading: boolean;
    canClaim: boolean;
    timeRemaining: string;
    isWhitelisted?: boolean;
    hasAttested?: boolean;
    onWhitelist?: () => void;
    onAttest?: () => void;
    onClaim?: () => void;
    isProcessing?: boolean;
}

export default function ClaimStatusDisplay({
    isLoading,
    canClaim,
    timeRemaining,
    isWhitelisted = false,
    hasAttested = false,
    onWhitelist,
    onAttest,
    onClaim,
    isProcessing = false,
}: ClaimStatusDisplayProps) {
    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-600 dark:text-yellow-400" />
                <span className="ml-2 text-yellow-800 dark:text-yellow-300 font-semibold">Checking eligibility...</span>
            </div>
        );
    }
    
    if (!canClaim && timeRemaining !== "Available now") {
        return (
            <div className="text-center py-4 space-y-2">
                <p className="text-xl font-semibold text-black dark:text-yellow-100">Next claim available in:</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{timeRemaining}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    You have already claimed your free bundle, please wait for the cooldown period.
                </p>
                
                {/* Display the 3-step claim process status */}
                <div className="mt-6 space-y-2 border-t border-yellow-200 dark:border-yellow-800 pt-4">
                    <ClaimStepInfo 
                        step="1. Whitelist"
                        completed={isWhitelisted}
                        onClick={onWhitelist}
                        disabled={isProcessing || isWhitelisted}
                        buttonText={isWhitelisted ? "Completed" : "Whitelist Now"}
                    />
                    <ClaimStepInfo 
                        step="2. Attestation"
                        completed={hasAttested}
                        onClick={onAttest}
                        disabled={isProcessing || !isWhitelisted || hasAttested}
                        buttonText={hasAttested ? "Completed" : "Attest Now"}
                    />
                    <ClaimStepInfo 
                        step="3. Claim Bundle"
                        completed={false}
                        info="Cooldown period active"
                        disabled={true}
                        buttonText="Wait for cooldown"
                    />
                </div>
            </div>
        );
    }
    
    // If not claimed yet, show the 3-step process
    if (!canClaim || !timeRemaining.includes("Available now")) {
        return (
            <div className="mt-6 space-y-4 text-center">
                <h3 className="text-lg font-bold text-yellow-700 dark:text-yellow-300">Complete these steps to claim:</h3>
                <div className="space-y-3 border rounded-lg p-4 border-yellow-200 dark:border-yellow-800">
                    <ClaimStepInfo 
                        step="1. Whitelist"
                        completed={isWhitelisted}
                        onClick={onWhitelist}
                        disabled={isProcessing || isWhitelisted}
                        buttonText={isWhitelisted ? "Completed" : "Whitelist Now"}
                    />
                    <ClaimStepInfo 
                        step="2. Attestation"
                        completed={hasAttested}
                        onClick={onAttest}
                        disabled={isProcessing || !isWhitelisted || hasAttested}
                        buttonText={hasAttested ? "Completed" : "Attest Now"}
                    />
                    <ClaimStepInfo 
                        step="3. Claim Bundle"
                        completed={false}
                        onClick={onClaim}
                        disabled={isProcessing || !isWhitelisted || !hasAttested}
                        buttonText="Claim Bundle"
                    />
                </div>
            </div>
        );
    }
    
    return null;
}

interface ClaimStepInfoProps {
    step: string;
    completed?: boolean;
    info?: string;
    onClick?: () => void;
    disabled?: boolean;
    buttonText: string;
}

function ClaimStepInfo({ step, completed = false, info, onClick, disabled = false, buttonText }: ClaimStepInfoProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-2 sm:mb-0">
                {completed ? (
                    <Check className="h-5 w-5 text-green-500" />
                ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <span className={`font-medium ${completed ? 'text-green-700 dark:text-green-400' : 'text-black dark:text-yellow-100'}`}>
                    {step}
                </span>
            </div>
            
            {info && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 sm:mb-0 sm:mx-2">{info}</p>}
            
            {onClick ? (
                <button
                    onClick={onClick}
                    disabled={disabled}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                        ${completed 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default'
                            : disabled
                                ? 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100 hover:bg-yellow-300 dark:hover:bg-yellow-600'
                        }`}
                >
                    {disabled && !completed ? (
                        <div className="flex items-center">
                            <span>{buttonText}</span>
                        </div>
                    ) : buttonText}
                </button>
            ) : (
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{buttonText}</span>
            )}
        </div>
    );
}
