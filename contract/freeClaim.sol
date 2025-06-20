// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FreeDataBundle
 * @dev Smart contract for free data bundle claiming with whitelist and attestation
 * @notice Users must first whitelist themselves, then attest before claiming
 * Once claimed, users must wait 12 hours before claiming again
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Deploy this contract to the blockchain
 * 2. Copy the deployed contract address 
 * 3. Update the FREE_DATA_BUNDLE_ADDRESS constant in contractInteractions.ts
 * 4. Restart the application
 */
contract FreeDataBundle {
    // Contract owner
    address public owner;

    // Mapping for whitelisted addresses
    mapping(address => bool) public isWhitelisted;
    
    // Mapping for attested addresses
    mapping(address => bool) public hasAttested;
    
    // Mapping for last claim timestamp
    mapping(address => uint256) public lastClaimTime;
    
    // Claim cooldown period (12 hours in seconds)
    uint256 public constant CLAIM_COOLDOWN = 12 hours;
    
    // Total number of claims made
    uint256 public totalClaims;
    
    // Events for each action
    event UserWhitelisted(address indexed user, uint256 timestamp);
    event UserAttested(address indexed user, uint256 timestamp, string attestation);
    event BundleClaimed(address indexed user, uint256 timestamp, uint256 claimNumber);
    
    // Custom errors
    error AlreadyWhitelisted();
    error NotWhitelisted();
    error NotAttested();
    error ClaimTooSoon(uint256 nextAvailableTime);
    error NotOwner();

    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Allows a user to whitelist themselves
     * @notice Users must whitelist before attestation
     */    function whitelistSelf() external {
        if (isWhitelisted[msg.sender]) {
            revert AlreadyWhitelisted();
        }

        isWhitelisted[msg.sender] = true;
        
        // Emit whitelist event
        emit UserWhitelisted(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Allows a whitelisted user to attest
     * @param attestationText The text of the attestation
     * @notice User must be whitelisted before attesting
     */
    function attest(string calldata attestationText) external {
        // Check if whitelisted
        if (!isWhitelisted[msg.sender]) {
            revert NotWhitelisted();
        }
        
        hasAttested[msg.sender] = true;
        
        emit UserAttested(msg.sender, block.timestamp, attestationText);
    }
    
    /**
     * @dev Allows an attested user to claim a free data bundle
     * @notice User must wait 12 hours between claims
     * @return claimNumber The number of the claim (total claims made)
     */
    function claim() external returns (uint256 claimNumber) {
        // Check if whitelisted
        if (!isWhitelisted[msg.sender]) {
            revert NotWhitelisted();
        }
        
        // Check if attested
        if (!hasAttested[msg.sender]) {
            revert NotAttested();
        }
        
        // Check cooldown period
        uint256 lastClaim = lastClaimTime[msg.sender];
        if (lastClaim > 0 && block.timestamp < lastClaim + CLAIM_COOLDOWN) {
            uint256 nextAvailableTime = lastClaim + CLAIM_COOLDOWN;
            revert ClaimTooSoon(nextAvailableTime);
        }
        
        lastClaimTime[msg.sender] = block.timestamp;
        
        totalClaims++;

        emit BundleClaimed(msg.sender, block.timestamp, totalClaims);

        return totalClaims;
    }

    /**
     * @dev Check if a user can claim
     * @param user Address of the user to check
     * @return canClaim Whether the user can claim
     * @return timeRemaining Time remaining until next claim (0 if can claim now)
     */
    function canUserClaim(address user) external view returns (bool canClaim, uint256 timeRemaining) {
        // Initial checks for whitelist and attestation
        if (!isWhitelisted[user] || !hasAttested[user]) {
            return (false, 0);
        }
        
        uint256 lastClaim = lastClaimTime[user];
        uint256 nextClaimTime = lastClaim + CLAIM_COOLDOWN;
        
        // If first claim or cooldown period passed
        if (lastClaim == 0 || block.timestamp >= nextClaimTime) {
            return (true, 0);
        }
        
        // Calculate time remaining for next claim
        return (false, nextClaimTime - block.timestamp);
    }
    
    /**
     * @dev Allows owner to toggle whitelist status for an address
     * @param user Address to update
     * @param status New whitelist status
     */
    function setWhitelistStatus(address user, bool status) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        isWhitelisted[user] = status;
    }
    
    /**
     * @dev Allows owner to toggle attestation status for an address
     * @param user Address to update
     * @param status New attestation status
     */
    function setAttestationStatus(address user, bool status) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        hasAttested[user] = status;
    }
    
    /**
     * @dev Allows owner to reset the cooldown for a user
     * @param user Address to reset cooldown for
     */
    function resetCooldown(address user) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        lastClaimTime[user] = 0;
    }
    
    /**
     * @dev Get user status information
     * @param user Address to check
     * @return isUserWhitelisted Whether the user is whitelisted
     * @return hasUserAttested Whether the user has attested
     * @return lastUserClaimTime The timestamp of the user's last claim
     * @return nextAvailableClaimTime When the user can claim next (0 if can claim now)
     */
    function getUserStatus(address user) external view returns (
        bool isUserWhitelisted,
        bool hasUserAttested,
        uint256 lastUserClaimTime,
        uint256 nextAvailableClaimTime
    ) {
        isUserWhitelisted = isWhitelisted[user];
        hasUserAttested = hasAttested[user];
        lastUserClaimTime = lastClaimTime[user];
        
        if (lastUserClaimTime > 0) {
            uint256 nextClaimTime = lastUserClaimTime + CLAIM_COOLDOWN;
            nextAvailableClaimTime = block.timestamp >= nextClaimTime ? 0 : nextClaimTime;
        } else {
            nextAvailableClaimTime = 0;
        }
        
        return (isUserWhitelisted, hasUserAttested, lastUserClaimTime, nextAvailableClaimTime);
    }
}