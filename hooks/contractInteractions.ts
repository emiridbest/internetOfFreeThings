import { createPublicClient, http, getContract, createWalletClient } from 'viem';
import { base, } from 'viem/chains';
import { FreeDataBundleABI } from '../lib/FreeDataBundleABI';
import { EthDispenserABI } from '../lib/EthDispenserABI';
import { ethers } from 'ethers';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk'
import { useSendTransaction } from '@privy-io/react-auth';
import { useCallback } from 'react';
import { PaymasterMode } from "@biconomy/account";

const FREE_DATA_BUNDLE_ADDRESS = "0x8c1FEe2C5B7679CAa62ffC8B530A50eAacc1B816" //"0x1b865a548244dc2109e747117c31544bea3d2e7c";
const ETH_DISPENSER_ADDRESS = "0x4f6a4d0C72dc5C8d712B3fAFf28D82B86b8b0eA4"
// Base mainnet public RPC endpoints (Forno is Celo, not Base)
const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.publicnode.com",
  "https://rpc.ankr.com/base",
  "https://1rpc.io/base",
  "https://base.llamarpc.com"
];

// Default to the first URL
let RPC_URL = RPC_URLS[0];



// Function to find a working RPC URL
const findWorkingRpcUrl = async () => {
  for (const url of RPC_URLS) {
    try {
      const client = createPublicClient({
        chain: base,
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
    chain: base,
    transport: http(RPC_URL)
  });
};

// Create a wallet client for transactions
export const getWalletClient = (address: `0x${string}`) => {
  return createWalletClient({
    account: address,
    chain: base,
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

// Custom hook for contract write operations with maximum gas settings
export function useContractInteractions() {
  const { sendTransaction } = useSendTransaction();

  //use smart wallet to ask for ETH
  const dispenseETH = async (address: `0x${string}`, smartAccount: any) => {
    try {
      if (!smartAccount || !address) {
        return {
          success: false,
          error: new Error("Smart account or address not initialized")
        };
      }

      // Try to find a working RPC URL first
      await findWorkingRpcUrl();

      // Initialize an ethers JsonRpcProvider for your network
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

      // Initialize an ethers contract instance
      const contract = new ethers.Contract(ETH_DISPENSER_ADDRESS, EthDispenserABI, provider);

      // Get the function data for whitelistSelf directly using the interface
      const iface = new ethers.utils.Interface(EthDispenserABI);
      const functionData = iface.encodeFunctionData('dispenseETH', [address]);

      const referralTag = prepareReferralTag(smartAccount.accountAddress);
      // Construct transaction for smart account
      const dispenseETH = {
        to: ETH_DISPENSER_ADDRESS,
        data: functionData + referralTag
      };

      // Send transaction to mempool gaslessly
      const userOpResponse = await smartAccount.sendTransaction(dispenseETH, {
        paymasterServiceData: { mode: PaymasterMode.SPONSORED }
      });

      const { transactionHash } = await userOpResponse.waitForTxHash();
      console.log('Transaction Hash', transactionHash);
      await processTransaction(transactionHash);
      const userOpReceipt = await userOpResponse.wait();

      if (userOpReceipt.success === 'true') {
        console.log('UserOp receipt', userOpReceipt);
        console.log('Transaction receipt', userOpReceipt.receipt);


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


  // Common function to prepare referral tag
  const prepareReferralTag = useCallback((address: `0x${string}`) => {
    return getReferralTag({
      user: address,
      consumer: '0xb82896C4F251ed65186b416dbDb6f6192DFAF926',
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
      console.log('Gas used:', receipt.gasUsed);
      console.log('Effective gas price:', receipt.effectiveGasPrice);

      // Submit referral to Divvi
      await submitReferral({
        txHash: txHash as `0x${string}`,
        chainId: base.id,
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

  // Whitelist self function with maximum gas
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

      // Get maximum gas configuration

      // Generate referral tag

      // Get the function data for whitelistSelf
      const iface = new ethers.utils.Interface(FreeDataBundleABI);
      const functionData = iface.encodeFunctionData('increment', []);

      // Sign transaction using Privy's hook with maximum gas settings
      const signedTx = await sendTransaction({
        from: address,
        to: FREE_DATA_BUNDLE_ADDRESS,
        data: functionData,
        chainId: base.id,
    

      });

      // Process the transaction

    } catch (error) {
      console.error("Error adding to whitelist:", error);
      return {
        success: false,
        error
      };
    }
  }, [sendTransaction, prepareReferralTag, processTransaction]);

  // Submit attestation function with maximum gas
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

      // Get maximum gas configuration

      // Generate referral tag
      const referralTag = prepareReferralTag(address);

      // Get the function data for attest
      const iface = new ethers.utils.Interface(FreeDataBundleABI);
      const functionData = iface.encodeFunctionData('attest', [attestationText]);
      const dataWithReferral = functionData + referralTag;

      // Sign transaction using Privy's hook with maximum gas settings
      const signedTx = await sendTransaction({
        from: address,
        to: FREE_DATA_BUNDLE_ADDRESS,
        data: dataWithReferral,
        chainId: base.id,

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

  // Claim bundle function with maximum gas
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

      // Get maximum gas configuration

      // Generate referral tag
      const referralTag = prepareReferralTag(address);

      // Get the function data for claim
      const iface = new ethers.utils.Interface(FreeDataBundleABI);
      const functionData = iface.encodeFunctionData('batchAlwaysExecuteAll', []);
      const dataWithReferral = functionData + referralTag;

      // Sign transaction using Privy's hook with maximum gas settings
      const signedTx = await sendTransaction({
        from: address,
        to: FREE_DATA_BUNDLE_ADDRESS,
        data: dataWithReferral,
        chainId: base.id,

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
  // Regular wallet function to deposit ETH
  // Claim bundle function with maximum gas
  const depositETH = useCallback(async (address: `0x${string}`) => {
    try {
      if (!address || !sendTransaction) {
        return {
          success: false,
          error: new Error("Address not provided or sendTransaction hook not available")
        };
      }

      // Try to find a working RPC URL first
      await findWorkingRpcUrl();

      // Get the function data for claim
      // Sign transaction using Privy's hook with maximum gas settings
      const signedTx = await sendTransaction({
        from: address,
        to: ETH_DISPENSER_ADDRESS,
        value: BigInt(1000000000000000), // 0.001 ETH in wei as BigInt
        chainId: base.id,

      });

      // Process the transaction
      return signedTx

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
    claimBundle,
    dispenseETH,
    depositETH,
  };
}

// Export the hook and read functions
export default useContractInteractions;