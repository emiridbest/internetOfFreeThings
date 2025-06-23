"use client";

import { useState, useCallback } from "react";
import { getAccessToken } from "@privy-io/react-auth";
import type { AuthenticateSuccessResponse } from "@/app/api/verify/route";

/**
 * Custom hook for token verification
 * Provides a reusable way to verify Privy tokens across the application
 */
export function useTokenVerification() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AuthenticateSuccessResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Verify the current user's Privy token
   * @returns The verification result containing claims on success
   */
  const verifyToken = useCallback(async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const url = "/api/verify";
      const accessToken = await getAccessToken();
      
      const result = await fetch(url, {
        method: "POST", 
        headers: {
          "Content-Type": "application/json", 
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      // Handle error responses
      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.error || `HTTP ${result.status}`);
      }

      // Parse and store the verification result
      const data = await result.json() as AuthenticateSuccessResponse;
      setVerificationResult(data);
      return data;
    } catch (error) {
      console.error("Token verification failed:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  // Return the hook interface
  return {
    verifyToken,
    isVerifying,
    verificationResult,
    error
  };
}
