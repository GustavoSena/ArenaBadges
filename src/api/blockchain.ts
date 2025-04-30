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

// ERC-721 ABI (minimal for ownerOf function only)
const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)"
];

/**
 * Fetch NFT holders using sequential token ID scanning with robust error handling and retries
 * @param contractAddress The NFT contract address
 * @param tokenName The name of the NFT
 * @param minBalance Minimum balance required (default: 1)
 * @param verbose Whether to show verbose logs
 * @returns Array of NFT holders
 */
export async function fetchNftHolders(
  contractAddress: string,
  tokenName: string,
  minBalance: number = 1,
  verbose: boolean = false
): Promise<NftHolder[]> {
  try {
    if (verbose) {
      console.log(`Fetching NFT holders for ${tokenName} (${contractAddress}) using sequential token ID scanning...`);
    } else {
      console.log(`Fetching NFT holders for ${tokenName}...`);
    }
    
    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
    
    // Map to store holder addresses and token counts
    const holderMap = new Map<string, number>();
    
    // Start checking token IDs from 0
    let tokenId = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 100; // Stop after this many consecutive failures
    const MAX_TOKEN_ID = 20000; // Safety limit
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
                
                if (verbose) console.log(`Token ${currentTokenId}: Owner ${shortenAddress(ownerLower)}`);
                
                batchSuccesses++;
                return true; // Success
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isInvalidTokenId = errorMessage.includes("invalid token ID") || 
                                        errorMessage.includes("nonexistent token") ||
                                        errorMessage.includes("owner query for nonexistent token") ||
                                        errorMessage.includes("ERC721: invalid token ID") ||
                                        errorMessage.includes("ERC721: owner query for nonexistent token");
                
                if (isInvalidTokenId) {
                  // No need to retry for invalid token IDs
                  if (verbose) console.log(`Token ${currentTokenId}: Invalid token ID`);
                  return false; // Failure
                }
                
                // For other errors, retry with exponential backoff
                retryCount++;
                if (retryCount <= MAX_RETRIES) {
                  if (verbose) console.log(`Error fetching owner for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES}...`);
                  // Exponential backoff
                  await sleep(500 * Math.pow(2, retryCount - 1));
                } else {
                  console.error(`Failed to get owner for token ${currentTokenId} after ${MAX_RETRIES} retries:`, error);
                }
              }
            }
            
            return false; // Max retries reached
          })()
        );
      }
      
      // Wait for all promises in the batch to resolve
      const results = await Promise.all(batchPromises);
      
      // Count successful token queries in this batch
      const successCount = results.filter(result => result).length;
      
      // Update consecutive failures counter
      if (successCount === 0) {
        consecutiveFailures += batchSize;
        if (verbose) console.log(`No valid tokens found in batch. Consecutive failures: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`);
      } else {
        if (verbose) console.log(`Found ${successCount} valid tokens in batch.`);
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

/**
 * Shorten an address for display in logs
 */
function shortenAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// For backward compatibility
export const fetchNftHoldersFromEthers = fetchNftHolders;
export const fetchNftHoldersWithoutTotalSupply = fetchNftHolders;
