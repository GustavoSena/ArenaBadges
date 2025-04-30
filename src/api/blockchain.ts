import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { NftHolder } from '../types/interfaces';
import { sleep } from '../utils/helpers';

// Load environment variables
dotenv.config();

// Get API key from .env
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
  console.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching NFT holders.');
}

// Avalanche RPC URL using Alchemy API key
const AVALANCHE_RPC_URL = `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Setup ethers provider for Avalanche
const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC_URL);

// ERC-721 ABI (minimal for ownerOf and totalSupply functions)
const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)"
];

/**
 * Fetch NFT holders from Ethers.js with robust error handling and retries
 * @param contractAddress The NFT contract address
 * @param tokenName The name of the NFT
 * @param minBalance Minimum balance required (default: 1)
 * @param verbose Whether to show verbose logs
 * @returns Array of NFT holders
 */
export async function fetchNftHoldersFromEthers(
  contractAddress: string,
  tokenName: string,
  minBalance: number = 1,
  verbose: boolean = false
): Promise<NftHolder[]> {
  try {
    if (verbose) {
      console.log(`Fetching NFT holders for ${tokenName} (${contractAddress}) using ethers.js...`);
    } else {
      console.log(`Fetching NFT holders for ${tokenName}...`);
    }
    
    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    
    // Get the total supply with retries
    const MAX_RETRIES = 5;
    let totalSupply: number;
    let retryCount = 0;
    
    while (true) {
      try {
        totalSupply = await contract.totalSupply();
        if (verbose) console.log(`Total supply: ${totalSupply}`);
        break;
      } catch (error) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.error(`Failed to get total supply after ${MAX_RETRIES} retries:`, error);
          throw error;
        }
        if (verbose) console.log(`Error fetching total supply, retry ${retryCount}/${MAX_RETRIES}...`);
        // Exponential backoff
        await sleep(1000 * Math.pow(2, retryCount - 1));
      }
    }
    
    // Map to store holder addresses and token counts
    const holderMap = new Map<string, number>();
    
    // Process in batches to avoid rate limiting
    const batchSize = 25;
    for (let i = 0; i < totalSupply; i += batchSize) {
      const endIndex = Math.min(i + batchSize, totalSupply);
      if (verbose) console.log(`Processing tokens ${i} to ${endIndex - 1}...`);
      
      const batchPromises = [];
      for (let tokenId = i; tokenId < endIndex; tokenId++) {
        batchPromises.push(
          (async () => {
            // Add retry mechanism for each token
            let ownerRetryCount = 0;
            
            while (true) {
              try {
                const owner = await contract.ownerOf(tokenId);
                const ownerLower = owner.toLowerCase();
                
                // Update holder map
                holderMap.set(ownerLower, (holderMap.get(ownerLower) || 0) + 1);
                break;
              } catch (error) {
                // Check if it's an invalid token ID error
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isInvalidTokenId = errorMessage.includes("invalid token ID") || 
                                        errorMessage.includes("nonexistent token") ||
                                        errorMessage.includes("owner query for nonexistent token");
                
                if (isInvalidTokenId) {
                  // No need to retry for invalid token IDs
                  if (verbose) console.log(`Token ${tokenId}: Invalid token ID`);
                  break;
                }
                
                ownerRetryCount++;
                if (ownerRetryCount > MAX_RETRIES) {
                  console.error(`Failed to get owner for token ${tokenId} after ${MAX_RETRIES} retries:`, error);
                  break;
                }
                
                if (verbose) console.log(`Error fetching owner for token ${tokenId}, retry ${ownerRetryCount}/${MAX_RETRIES}...`);
                // Exponential backoff
                await sleep(500 * Math.pow(2, ownerRetryCount - 1));
              }
            }
          })()
        );
      }
      
      // Wait for all promises in the batch to resolve
      await Promise.all(batchPromises);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < totalSupply) {
        await sleep(1000);
      }
    }
    
    // Convert holder map to array
    const holders: NftHolder[] = Array.from(holderMap.entries())
      .filter(([_, count]) => count >= minBalance)
      .map(([address, count]) => ({
        address,
        tokenCount: count,
        tokenName
      }));
    
    console.log(`Found ${holders.length} holders with at least ${minBalance} ${tokenName}`);
    
    return holders;
  } catch (error) {
    console.error(`Error fetching NFT holders for ${contractAddress}:`, error);
    
    // Return empty array on error
    console.log(`Returning empty array for ${tokenName} due to error`);
    return [];
  }
}

/**
 * Fallback function to handle NFT contracts that don't implement totalSupply
 * @param contractAddress The NFT contract address
 * @param tokenName The name of the NFT
 * @param minBalance Minimum balance required
 * @param verbose Whether to show verbose logs
 * @returns Array of NFT holders
 */
export async function fetchNftHoldersWithoutTotalSupply(
  contractAddress: string,
  tokenName: string,
  minBalance: number = 1,
  verbose: boolean = false
): Promise<NftHolder[]> {
  try {
    if (verbose) {
      console.log(`Fetching NFT holders for ${tokenName} (${contractAddress}) using sequential token ID scanning...`);
    } else {
      console.log(`Fetching NFT holders for ${tokenName} using fallback method...`);
    }
    
    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    
    // Map to store holder addresses and token counts
    const holderMap = new Map<string, number>();
    
    // Start checking token IDs from 0
    let tokenId = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 50; // Stop after this many consecutive failures
    const MAX_TOKEN_ID = 10000; // Safety limit
    const MAX_RETRIES = 5;
    
    // Process in batches to avoid rate limiting
    const batchSize = 25;
    
    while (tokenId < MAX_TOKEN_ID && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      if (verbose) console.log(`Processing tokens ${tokenId} to ${tokenId + batchSize - 1}...`);
      
      const batchPromises = [];
      let batchSuccesses = 0;
      
      for (let i = 0; i < batchSize; i++) {
        const currentTokenId = tokenId + i;
        
        batchPromises.push(
          (async () => {
            // Add retry mechanism for each token
            let retryCount = 0;
            
            while (retryCount <= MAX_RETRIES) {
              try {
                const owner = await contract.ownerOf(currentTokenId);
                const ownerLower = owner.toLowerCase();
                
                // Update holder map
                holderMap.set(ownerLower, (holderMap.get(ownerLower) || 0) + 1);
                
                batchSuccesses++;
                return true; // Success
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isInvalidTokenId = errorMessage.includes("invalid token ID") || 
                                        errorMessage.includes("nonexistent token") ||
                                        errorMessage.includes("owner query for nonexistent token");
                
                if (isInvalidTokenId) {
                  // No need to retry for invalid token IDs
                  return false; // Failure
                }
                
                retryCount++;
                if (retryCount <= MAX_RETRIES) {
                  // Add a small delay before retrying
                  await sleep(500 * Math.pow(2, retryCount - 1));
                }
              }
            }
            
            return false; // Max retries reached
          })()
        );
      }
      
      // Wait for all promises in the batch to resolve
      const results = await Promise.all(batchPromises);
      
      // Update consecutive failures counter
      if (batchSuccesses === 0) {
        consecutiveFailures += batchSize;
      } else {
        consecutiveFailures = 0; // Reset counter if we found any valid tokens
      }
      
      // Move to the next batch
      tokenId += batchSize;
      
      // Add delay between batches to avoid rate limiting
      await sleep(1000);
    }
    
    // Convert holder map to array
    const holders: NftHolder[] = Array.from(holderMap.entries())
      .filter(([_, count]) => count >= minBalance)
      .map(([address, count]) => ({
        address,
        tokenCount: count,
        tokenName
      }));
    
    console.log(`Found ${holders.length} holders with at least ${minBalance} ${tokenName}`);
    
    return holders;
  } catch (error) {
    console.error(`Error fetching NFT holders for ${contractAddress}:`, error);
    return [];
  }
}
