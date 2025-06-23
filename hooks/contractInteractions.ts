import { createPublicClient, http, getContract, createWalletClient } from 'viem';
import { lisk } from 'viem/chains';
import { FreeDataBundleABI } from '../lib/FreeDataBundleABI';
import { ethers } from 'ethers';
import { createSmartAccountClient, PaymasterMode } from "@biconomy/account";
const FREE_DATA_BUNDLE_ADDRESS = "0x1587cfa45ccc6b9de5373cd475d088d02a9158da" //'0x94a5d82a2d3561e0df469a4fcf6538c462bc1243';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';
// Setup RPC URL with fallbacks in case the primary URL fails
// This avoids the "net::ERR_NAME_NOT_RESOLVED" error
const RPC_URLS = [
  process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.api.lisk.com",
];

// Default to the first URL
let RPC_URL = RPC_URLS[0];

// Helper to get ethers signer from Privy wallet
export const getSignerFromPrivyWallet = async (privyWallet: any) => {
  if (!privyWallet) {
    throw new Error("No Privy wallet provided");
  }

  try {
    const provider = await privyWallet.getEthersProvider();
    return provider.getSigner();
  } catch (error) {
    console.error("Failed to get signer from Privy wallet:", error);
    throw error;
  }
};



// Try to find a working RPC URL and update the default if needed
export const findWorkingRpcUrl = async (): Promise<string> => {
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
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (response.ok) {
        console.log(`Using RPC URL: ${url}`);
        RPC_URL = url; // Update the global RPC_URL
        return url;
      }
    } catch (err) {
      console.warn(`RPC URL ${url} failed healthcheck`);
      // Continue to next URL
    }
  }

  console.warn("All RPC URLs failed, using default");
  return RPC_URL; // Return current RPC_URL even if all failed
};

export const getPublicClient = () => {
  // Use the current best RPC_URL
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

// Check if user is whitelisted
export const checkWhitelistStatus = async (userAddress: `0x${string}`) => {
  const contract = getContractRead();
  try {
    return await contract.read.isWhitelisted([userAddress]);
  } catch (error) {
    console.error("Error checking whitelist status:", error);
    return false;
  }
};

// Check if user has attested
export const checkAttestationStatus = async (userAddress: `0x${string}`) => {
  const contract = getContractRead();
  try {
    return await contract.read.hasAttested([userAddress]);
  } catch (error) {
    console.error("Error checking attestation status:", error);
    return false;
  }
};

// Check if user can claim
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

// Get full user status
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

// FIXED: Modified to accept wallet parameter instead of using hooks
// Whitelist self using Biconomy gasless transaction
export const whitelistSelf = async (address: `0x${string}`, smartAccount: any) => {
  try {
    if (!smartAccount || !address) {
      return {
        success: false,
        error: new Error("Smart account or address not initialized")
      };
    }

    // Try to find a working RPC URL first
    await findWorkingRpcUrl();
    // Generate referral tag
    const referralTag = getReferralTag({
      user: address,
      consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
      providers: ['0x0423189886d7966f0dd7e7d256898daeee625dca', '0xc95876688026be9d6fa7a7c33328bd013effa2bb', '0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'],
    });
    // Initialize an ethers JsonRpcProvider for your network
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    // Initialize an ethers contract instance
    const contract = new ethers.Contract(FREE_DATA_BUNDLE_ADDRESS, FreeDataBundleABI, provider);

    // Get the function data for whitelistSelf directly using the interface
    const iface = new ethers.utils.Interface(FreeDataBundleABI);
    const functionData = iface.encodeFunctionData('whitelistSelf', []);

    // Append referral tag to the contract call data
    const dataWithReferral = functionData + referralTag;

    // Construct transaction for smart account
    const whitelistTx = {
      to: FREE_DATA_BUNDLE_ADDRESS,
      data: dataWithReferral
    };

    // Send transaction to mempool gaslessly
    const userOpResponse = await smartAccount.sendTransaction(whitelistTx, {
      paymasterServiceData: { mode: PaymasterMode.SPONSORED }
    });

    const { transactionHash } = await userOpResponse.waitForTxHash();
    console.log('Transaction Hash', transactionHash);

    const userOpReceipt = await userOpResponse.wait();

    if (userOpReceipt.success === 'true') {
      console.log('UserOp receipt', userOpReceipt);
      console.log('Transaction receipt', userOpReceipt.receipt);

      // Submit referral to Divvi
      await submitReferral({
        txHash: transactionHash as `0x${string}`,
        chainId: lisk.id,
      });

      return {
        success: true,
        hash: transactionHash,
        receipt: userOpReceipt
      };
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    console.error("Error adding to whitelist:", error);
    return {
      success: false,
      error
    };
  }
};

// FIXED: Modified to accept wallet parameter
// Submit attestation using Biconomy gasless transaction
export const submitAttestation = async (attestationText: any, smartAccount: any) => {
  try {
    if (!smartAccount) {
      return {
        success: false,
        error: new Error("Smart account not initialized")
      };
    }

    // Try to find a working RPC URL first
    await findWorkingRpcUrl();    // Initialize an ethers JsonRpcProvider for your network
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const referralTag = getReferralTag({
      user: smartAccount.sender,
      consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
      providers: ['0x0423189886d7966f0dd7e7d256898daeee625dca', '0xc95876688026be9d6fa7a7c33328bd013effa2bb', '0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'],
    });
    // Get the function data for attest directly using the interface
    const iface = new ethers.utils.Interface(FreeDataBundleABI);
    const functionData = iface.encodeFunctionData('attest', [attestationText]);

    // Construct transaction for smart account
    const attestTx = {
      to: FREE_DATA_BUNDLE_ADDRESS,
      data: functionData + referralTag // Append referral tag to the data
    };

    // Send transaction to mempool gaslessly
    const userOpResponse = await smartAccount.sendTransaction(attestTx, {
      paymasterServiceData: { mode: PaymasterMode.SPONSORED }
    });

    const { transactionHash } = await userOpResponse.waitForTxHash();
    console.log('Transaction Hash', transactionHash);

    const userOpReceipt = await userOpResponse.wait();

    if (userOpReceipt.success === 'true') {
      console.log('UserOp receipt', userOpReceipt);
      console.log('Transaction receipt', userOpReceipt.receipt);
      // Submit referral to Divvi
      await submitReferral({
        txHash: transactionHash as `0x${string}`,
        chainId: lisk.id,
      });

      return {
        success: true,
        hash: transactionHash,
        receipt: userOpReceipt
      };
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    console.error("Error submitting attestation:", error);
    return {
      success: false,
      error
    };
  }
};

// FIXED: Modified to accept wallet parameter and smart account
// Claim bundle using Biconomy gasless transaction
export const claimBundle = async (smartAccount: any) => {
  try {
    if (!smartAccount) {
      return {
        success: false,
        error: new Error("Smart account not initialized")
      };
    }

    // Try to find a working RPC URL first
    await findWorkingRpcUrl();
    // Initialize an ethers JsonRpcProvider for your network
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const referralTag = getReferralTag({
      user: smartAccount.sender,
      consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
      providers: ['0x0423189886d7966f0dd7e7d256898daeee625dca', '0xc95876688026be9d6fa7a7c33328bd013effa2bb', '0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'],
    });
    // Get the function data for claim directly using the interface
    const iface = new ethers.utils.Interface(FreeDataBundleABI);
    const functionData = iface.encodeFunctionData('claim', []);

    // Construct transaction for smart account
    const claimTx = {
      to: FREE_DATA_BUNDLE_ADDRESS,
      data: functionData + referralTag // Append referral tag to the data
    };

    // Send transaction to mempool gaslessly
    const userOpResponse = await smartAccount.sendTransaction(claimTx, {
      paymasterServiceData: { mode: PaymasterMode.SPONSORED }
    });

    const { transactionHash } = await userOpResponse.waitForTxHash();
    console.log('Transaction Hash', transactionHash);

    const userOpReceipt = await userOpResponse.wait();

    if (userOpReceipt.success === 'true') {
      console.log('UserOp receipt', userOpReceipt);
      console.log('Transaction receipt', userOpReceipt.receipt);
      // Submit referral to Divvi
      await submitReferral({
        txHash: transactionHash as `0x${string}`,
        chainId: lisk.id,
      });

      return {
        success: true,
        hash: transactionHash,
        receipt: userOpReceipt
      };
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error: any) {
    console.error("Error claiming bundle:", error);

    // Check if it's a ClaimTooSoon error
    const isClaimTooSoonError = error.message?.includes('ClaimTooSoon');

    return {
      success: false,
      isClaimTooSoonError,
      error
    };
  }
};

// Format time remaining in human readable format
export const formatTimeRemaining = (seconds: number): string => {
  if (seconds === 0) return "Available now";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours}h ${minutes}m ${secs}s`;
};