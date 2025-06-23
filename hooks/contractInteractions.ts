import { createPublicClient, http, getContract, createWalletClient } from 'viem';
import { lisk } from 'viem/chains';
import { FreeDataBundleABI } from '../lib/FreeDataBundleABI';
import { ethers } from 'ethers';
const FREE_DATA_BUNDLE_ADDRESS = "0xfddbdb5bf0a70cb072535efad09ce0b5113c54c7" //'0x94a5d82a2d3561e0df469a4fcf6538c462bc1243';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';
import { useSendTransaction } from '@privy-io/react-auth';



const RPC_URLS = [
  process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.api.lisk.com",
];

// Default to the first URL
let RPC_URL = RPC_URLS[0];

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
        signal: AbortSignal.timeout(3000)
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


// Whitelist self using Privy's signTransaction hook
export const whitelistSelf = async (address: `0x${string}`) => {
  try {
    if (!address) {
      return {
        success: false,
        error: new Error("signTransaction function or address not provided")
      };
    }
    const { sendTransaction } = useSendTransaction();
    if (!sendTransaction) {
      return {
        success: false,
        error: new Error("sendTransaction hook not available")
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

    // Get the function data for whitelistSelf
    const iface = new ethers.utils.Interface(FreeDataBundleABI);
    const functionData = iface.encodeFunctionData('whitelistSelf', []);
    const dataWithReferral = functionData + referralTag;

    // Get current gas price and nonce
    const publicClient = getPublicClient();
    const gasPrice = await publicClient.getGasPrice();
    const nonce = await publicClient.getTransactionCount({ address });

    // Sign transaction using Privy's hook
    const signedTx = await sendTransaction({
      from: address,
      to: FREE_DATA_BUNDLE_ADDRESS,
      data: dataWithReferral,
      chainId: lisk.id,
    });

    // Broadcast the signed transaction
    console.log('Transaction Hash', signedTx.hash);

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash: signedTx.hash as `0x${string}` });

    if (receipt.status === 'success') {
      console.log('Transaction receipt', receipt);

      // Submit referral to Divvi
      await submitReferral({
        txHash: signedTx.hash as `0x${string}`,
        chainId: lisk.id,
      });

      return {
        success: true,
        hash: signedTx.hash,
        receipt: receipt
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

// Submit attestation using Privy's signTransaction hook
export const submitAttestation = async (attestationText: any, address: `0x${string}`) => {
  try {

    // Try to find a working RPC URL first
    await findWorkingRpcUrl();

    // Generate referral tag
    const referralTag = getReferralTag({
      user: address,
      consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
      providers: ['0x0423189886d7966f0dd7e7d256898daeee625dca', '0xc95876688026be9d6fa7a7c33328bd013effa2bb', '0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'],
    });
    const { sendTransaction } = useSendTransaction();
    if (!sendTransaction) {
      return {
        success: false,
        error: new Error("sendTransaction hook not available")
      };
    }
    // Get the function data for attest
    const iface = new ethers.utils.Interface(FreeDataBundleABI);
    const functionData = iface.encodeFunctionData('attest', [attestationText]);
    const dataWithReferral = functionData + referralTag;

    // Get current gas price and nonce
    const publicClient = getPublicClient();
    const gasPrice = await publicClient.getGasPrice();
    const nonce = await publicClient.getTransactionCount({ address });

    // Sign transaction using Privy's hook
    const signedTx = await sendTransaction({
      from: address,
      to: FREE_DATA_BUNDLE_ADDRESS,
      data: dataWithReferral,
      chainId: lisk.id,
    });

    // Broadcast the signed transaction
    console.log('Transaction Hash', signedTx.hash);

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash: signedTx.hash as `0x${string}` });

    if (receipt.status === 'success') {
      console.log('Transaction receipt', receipt);

      // Submit referral to Divvi
      await submitReferral({
        txHash: signedTx.hash as `0x${string}`,
        chainId: lisk.id,
      });

      return {
        success: true,
        hash: signedTx.hash,
        receipt: receipt
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

// Claim bundle using Privy's signTransaction hook
export const claimBundle = async (address: `0x${string}`) => {
  try {

    // Try to find a working RPC URL first
    await findWorkingRpcUrl();

    // Generate referral tag
    const referralTag = getReferralTag({
      user: address,
      consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
      providers: ['0x0423189886d7966f0dd7e7d256898daeee625dca', '0xc95876688026be9d6fa7a7c33328bd013effa2bb', '0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'],
    });
    const { sendTransaction } = useSendTransaction();
    if (!sendTransaction) {
      return {
        success: false,
        error: new Error("sendTransaction hook not available")
      };
    }
    // Get the function data for claim
    const iface = new ethers.utils.Interface(FreeDataBundleABI);
    const functionData = iface.encodeFunctionData('claim', []);
    const dataWithReferral = functionData + referralTag;

    // Get current gas price and nonce
    const publicClient = getPublicClient();
    const gasPrice = await publicClient.getGasPrice();
    const nonce = await publicClient.getTransactionCount({ address });

    // Sign transaction using Privy's hook
    const signedTx = await sendTransaction({
      from: address,
      to: FREE_DATA_BUNDLE_ADDRESS,
      data: dataWithReferral,
      chainId: lisk.id,
    });

    // Broadcast the signed transaction
    console.log('Transaction Hash', signedTx.hash);

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash: signedTx.hash as `0x${string}` });

    if (receipt.status === 'success') {
      console.log('Transaction receipt', receipt);

      // Submit referral to Divvi
      await submitReferral({
        txHash: signedTx.hash as `0x${string}`,
        chainId: lisk.id,
      });

      return {
        success: true,
        hash: signedTx.hash,
        receipt: receipt
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