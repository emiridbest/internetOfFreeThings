import { createPublicClient, createWalletClient, custom, http, getContract, encodeAbiParameters } from 'viem';
import { lisk } from 'viem/chains';
import { FreeDataBundleABI } from '../lib/FreeDataBundleABI';
import { ethers } from 'ethers';

const FREE_DATA_BUNDLE_ADDRESS = '0x0bcde4e9abee4f3e02325ca9f76e096c30e8a674';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk'

export const getPublicClient = () => {
  return createPublicClient({
    chain: lisk,
    transport: http()
  });
};

export const getWalletClient = (address: `0x${string}`) => {
  if (!window.ethereum) {
    throw new Error("No ethereum provider found");
  }

  return createWalletClient({
    account: address,
    chain: lisk,
    transport: custom(window.ethereum)
  });
};

// Divvi Integration 



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

// Whitelist self
export const whitelistSelf = async (address: `0x${string}`) => {
  const walletClient = getWalletClient(address);
  const contract = getContractWrite(address);
  
  // Generate referral tag
  const referralTag = getReferralTag({
    user: address,
    consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
    providers: ['0x0423189886d7966f0dd7e7d256898daeee625dca', '0xc95876688026be9d6fa7a7c33328bd013effa2bb', '0x7beb0e14f8d2e6f6678cc30d867787b384b19e20'],
  });
  
  try {
    // Use ethers Interface to encode the function call
    const contractInterface = new ethers.Interface([
      "function whitelistSelf()"
    ]);
    
    // Encode the function call data
    const contractCallData = contractInterface.encodeFunctionData("whitelistSelf", []);
    
    // Append referral tag to the contract call data (remove '0x' from referralTag if present)
    const dataWithReferral = contractCallData + referralTag

    // Send transaction with referral tag appended to data
    const hash = await walletClient.sendTransaction({
      account: address,
      to: contract.address, // Your contract address
      data: dataWithReferral as `0x${string}`,
      chainId: lisk.id,
    });
    
    console.log('Transaction hash:', hash);
    
    const chainId = await walletClient.getChainId();
    console.log('Chain ID:', chainId);
    
    // Submit referral to Divvi
    await submitReferral({
      txHash: hash,
      chainId,
    });
    
    return {
      success: true,
      hash
    };
  } catch (error) {
    console.error("Error adding to whitelist:", error);
    return {
      success: false,
      error
    };
  }
};
// Attest
export const submitAttestation = async (address: `0x${string}`, attestationText: string) => {
  try {
    const contract = getContractWrite(address);
    const hash = await contract.write.attest([attestationText]);
    return {
      success: true,
      hash
    };
  } catch (error) {
    console.error("Error submitting attestation:", error);
    return {
      success: false,
      error
    };
  }
};

// Claim
export const claimBundle = async (address: `0x${string}`) => {
  try {
    const contract = getContractWrite(address);
    const hash = await contract.write.claim();
    return {
      success: true,
      hash
    };
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
