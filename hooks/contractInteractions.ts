import { createPublicClient, http, getContract, createWalletClient } from 'viem';
import { lisk } from 'viem/chains';
import { FreeDataBundleABI } from '../lib/FreeDataBundleABI';
import { ethers } from 'ethers';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';
import { useSendTransaction } from '@privy-io/react-auth';
import { useState, useCallback } from 'react';

const FREE_DATA_BUNDLE_ADDRESS = "0xa62dc5ac9466fb9a9ed18eaa677184ad29a26c8d";

const RPC_URLS = [
  process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.api.lisk.com",
];

// Default to the first URL
let RPC_URL = RPC_URLS[0];

// Function to find a working RPC URL
const findWorkingRpcUrl = async () => {
  for (const url of RPC_URLS) {
    try {
      const client = createPublicClient({
        chain: lisk,
        transport: http(url)
      });
      
      // Simple health check - try to get the block number
      await client.getBlockNumber();
      console.log(`RPC URL ${url} is working`);
      RPC_URL = url;
      return url;
    } catch (err) {
      console.warn(`RPC URL ${url} failed healthcheck`);
      // Continue to next URL
    }
  }

  console.warn("All RPC URLs failed, using default");
  return RPC_URL; // Return current RPC_URL even if all failed
};

// Create a public client for read operations
export const getPublicClient = () => {
  return createPublicClient({
    chain: lisk,
    transport: http(RPC_URL)
  });
};

// Create a wallet client for transactions
export const getWalletClient = (address: `0x${string}`) => {
  return createWalletClient({
    account: address,
    chain: lisk,
    transport: http(RPC_URL)
  });
};

// Get contract instances
export const getContractRead = () => {
  const publicClient = getPublicClient();
  return getContract({
    address: FREE_DATA_BUNDLE_ADDRESS as `0x${string}`,
    abi: FreeDataBundleABI,
    client: publicClient
  });
};

export const getContractWrite = (address: `0x${string}`) => {
  const walletClient = getWalletClient(address);
  return getContract({
    address: FREE_DATA_BUNDLE_ADDRESS as `0x${string}`,
    abi: FreeDataBundleABI,
    client: walletClient
  });
};

// Read operations - these don't use hooks so they can stay as regular functions
export const checkWhitelistStatus = async (userAddress: `0x${string}`) => {
  const contract = getContractRead();
  try {
    return await contract.read.isWhitelisted([userAddress]);
  } catch (error) {
    console.error("Error checking whitelist status:", error);
    return false;
  }
};

export const checkAttestationStatus = async (userAddress: `0x${string}`) => {
  const contract = getContractRead();
  try {
    return await contract.read.hasAttested([userAddress]);
  } catch (error) {
    console.error("Error checking attestation status:", error);
    return false;
  }
};

export const checkClaimEligibility = async (userAddress: `0x${string}`) => {
  const contract = getContractRead();
  try {
    const result = await contract.read.canUserClaim([userAddress]) as [boolean, bigint];
    const [canClaim, timeRemaining] = result;
    return {
      canClaim,
      timeRemaining: Number(timeRemaining),
    };
  } catch (error) {
    console.error("Error checking claim eligibility:", error);
    return {
      canClaim: false,
      timeRemaining: 0,
    };
  }
};

export const getUserStatus = async (userAddress: `0x${string}`) => {
  const contract = getContractRead();
  try {
    const result = await contract.read.getUserStatus([userAddress]) as [boolean, boolean, bigint, bigint];
    const [isWhitelisted, hasAttested, lastClaimTime, nextAvailableTime] = result;
    return {
      isWhitelisted,
      hasAttested,
      lastClaimTime: Number(lastClaimTime),
      nextAvailableTime: Number(nextAvailableTime),
      canClaim: isWhitelisted && hasAttested && Number(nextAvailableTime) === 0
    };
  } catch (error) {
    console.error("Error getting user status:", error);
    return {
      isWhitelisted: false,
      hasAttested: false,
      lastClaimTime: 0,
      nextAvailableTime: 0,
      canClaim: false
    };
  }
};

// Custom hook for contract write operations
// This is where we properly use the useSendTransaction hook
export function useContractInteractions() {
  const { sendTransaction } = useSendTransaction();
  
  // Common function to prepare referral tag
  const prepareReferralTag = useCallback((address: `0x${string}`) => {
    return getReferralTag({
      user: address,
      consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
      providers: [
        '0x0423189886d7966f0dd7e7d256898daeee625dca', 
        '0xc95876688026be9d6fa7a7c33328bd013effa2bb', 
        '0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'
      ],
    });
  }, []);
  
  // Shared transaction processing logic
  const processTransaction = useCallback(async (txHash: string) => {
    const publicClient = getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash as `0x${string}` 
    });
    
    if (receipt.status === 'success') {
      console.log('Transaction receipt', receipt);
      
      // Submit referral to Divvi
      await submitReferral({
        txHash: txHash as `0x${string}`,
        chainId: lisk.id,
      });
      
      return {
        success: true,
        hash: txHash,
        receipt: receipt
      };
    } else {
      throw new Error('Transaction failed');
    }
  }, []);

  // Whitelist self function
  const whitelistSelf = useCallback(async (address: `0x${string}`) => {
    try {
      if (!address || !sendTransaction) {
        return {
          success: false,
          error: new Error("Address not provided or sendTransaction hook not available")
        };
      }

      // Try to find a working RPC URL first
      await findWorkingRpcUrl();

      // Generate referral tag
      const referralTag = prepareReferralTag(address);

      // Get the function data for whitelistSelf
      const iface = new ethers.utils.Interface(FreeDataBundleABI);
      const functionData = iface.encodeFunctionData('whitelistSelf', []);
      const dataWithReferral = functionData + referralTag;

      // Sign transaction using Privy's hook
      const signedTx = await sendTransaction({
        from: address,
        to: FREE_DATA_BUNDLE_ADDRESS,
        data: dataWithReferral,
        chainId: lisk.id,
      });

      // Process the transaction
      return await processTransaction(signedTx.hash);
      
    } catch (error) {
      console.error("Error adding to whitelist:", error);
      return {
        success: false,
        error
      };
    }
  }, [sendTransaction, prepareReferralTag, processTransaction]);

  // Submit attestation function
  const submitAttestation = useCallback(async (attestationText: any, address: `0x${string}`) => {
    try {
      if (!address || !sendTransaction) {
        return {
          success: false,
          error: new Error("Address not provided or sendTransaction hook not available")
        };
      }

      // Try to find a working RPC URL first
      await findWorkingRpcUrl();

      // Generate referral tag
      const referralTag = prepareReferralTag(address);

      // Get the function data for attest
      const iface = new ethers.utils.Interface(FreeDataBundleABI);
      const functionData = iface.encodeFunctionData('attest', [attestationText]);
      const dataWithReferral = functionData + referralTag;

      // Sign transaction using Privy's hook
      const signedTx = await sendTransaction({
        from: address,
        to: FREE_DATA_BUNDLE_ADDRESS,
        data: dataWithReferral,
        chainId: lisk.id
      });

      // Process the transaction
      return await processTransaction(signedTx.hash);
      
    } catch (error) {
      console.error("Error submitting attestation:", error);
      return {
        success: false,
        error
      };
    }
  }, [sendTransaction, prepareReferralTag, processTransaction]);

  // Claim bundle function
  const claimBundle = useCallback(async (address: `0x${string}`) => {
    try {
      if (!address || !sendTransaction) {
        return {
          success: false,
          error: new Error("Address not provided or sendTransaction hook not available")
        };
      }

      // Try to find a working RPC URL first
      await findWorkingRpcUrl();

      // Generate referral tag
      const referralTag = prepareReferralTag(address);

      // Get the function data for claim
      const iface = new ethers.utils.Interface(FreeDataBundleABI);
      const functionData = iface.encodeFunctionData('claim', []);
      const dataWithReferral = functionData + referralTag;

      // Sign transaction using Privy's hook
      const signedTx = await sendTransaction({
        from: address,
        to: FREE_DATA_BUNDLE_ADDRESS,
        data: dataWithReferral,
        chainId: lisk.id,
        gasPrice: 100000000000,
        gasLimit: 10000000        
      });

      // Process the transaction
      return await processTransaction(signedTx.hash);
      
    } catch (error) {
      console.error("Error claiming bundle:", error);
      return {
        success: false,
        error
      };
    }
  }, [sendTransaction, prepareReferralTag, processTransaction]);

  // Return all the contract interaction functions
  return {
    whitelistSelf,
    submitAttestation,
    claimBundle
  };
}

// Export the hook and read functions
export default useContractInteractions;
