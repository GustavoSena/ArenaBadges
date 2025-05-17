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

// ERC-20 ABI (minimal for balanceOf function)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
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
                
                // Check for rate limiting errors first
                const isRateLimited = 
                  errorMessage.includes("exceeded its compute units") || 
                  errorMessage.includes("rate limit") || 
                  errorMessage.includes("too many requests") ||
                  errorMessage.includes("429");
                
                // Check for truly invalid token IDs
                const isInvalidTokenId = 
                  errorMessage.includes("invalid token ID") || 
                  errorMessage.includes("nonexistent token") ||
                  errorMessage.includes("owner query for nonexistent token") ||
                  errorMessage.includes("ERC721: invalid token ID") ||
                  errorMessage.includes("ERC721: owner query for nonexistent token");
                
                // Check for revert errors that might be invalid tokens or other issues
                const isRevertError = 
                  errorMessage.includes("missing revert data") ||
                  (errorMessage.includes("CALL_EXCEPTION") && errorMessage.includes("revert=null"));
                
                if (isRateLimited) {
                  // Always retry rate limiting with a longer backoff
                  retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    // Use a longer backoff for rate limiting (2-10 seconds)
                    const backoffTime = 2000 * Math.pow(2, retryCount - 1);
                    if (verbose) console.log(`Rate limit hit for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES} after ${backoffTime}ms...`);
                    await sleep(backoffTime);
                  } else {
                    const errorMsg = `Failed to get owner for token ${currentTokenId} after ${MAX_RETRIES} retries due to rate limiting`;
                    console.error(errorMsg);
                    throw new Error(errorMsg);
                  }
                } else if (isInvalidTokenId) {
                  // These are definitely invalid tokens, no need to retry
                  if (verbose) console.log(`Token ${currentTokenId}: Invalid token ID`);
                  return false;
                } else if (isRevertError) {
                  // Revert errors could be invalid tokens or temporary issues, retry a few times
                  retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    if (verbose) console.log(`Revert error for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES}...`);
                    await sleep(1000 * Math.pow(1.5, retryCount - 1));
                  } else {
                    if (verbose) console.log(`Token ${currentTokenId}: Considered invalid after ${MAX_RETRIES} revert errors`);
                    return false;
                  }
                } else {
                  // For other errors, retry with exponential backoff
                  retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    if (verbose) console.log(`Error fetching owner for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES}...`);
                    // Exponential backoff
                    await sleep(500 * Math.pow(2, retryCount - 1));
                  } else {
                    const errorMsg = `Failed to get owner for token ${currentTokenId} after ${MAX_RETRIES} retries: ${error instanceof Error ? error.message : String(error)}`;
                    console.error(errorMsg);
                    throw new Error(errorMsg);
                  }
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
    
    // If this is a retry-related error, propagate it
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Failed to get owner') || 
        errorMessage.includes('after 5 retries') || 
        errorMessage.includes('max retries exceeded') || 
        errorMessage.includes('rate limit')) {
      throw new Error(`Retry failure in NFT holder fetching: ${errorMessage}`);
    }
    
    // For other errors, return empty array
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

/**
 * Fetch NFT holders without using total supply
 * @param contractAddress NFT contract address
 * @param tokenName NFT token name
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
    if (verbose) console.log(`Fetching holders for ${tokenName} (${contractAddress})...`);
    
    // Fetch NFT holders from Ethers
    const nftHolders = await fetchNftHoldersFromEthers(
      contractAddress,
      tokenName,
      minBalance,
      verbose
    );
    
    if (verbose) console.log(`Found ${nftHolders.length} holders with at least ${minBalance} ${tokenName}`);
    
    return nftHolders;
  } catch (error) {
    console.error(`Error fetching NFT holders for ${tokenName}:`, error);
    return [];
  }
}

/**
 * Fetch token balance for a specific address using ethers.js
 * @param tokenAddress The token contract address
 * @param holderAddress The address to check balance for
 * @param tokenDecimals The number of decimals for the token
 * @param verbose Whether to show verbose logs
 * @returns Formatted token balance as a number
 */
export async function fetchTokenBalanceWithEthers(
  tokenAddress: string,
  holderAddress: string,
  tokenDecimals: number,
  verbose: boolean = false
): Promise<number> {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      // Create contract instance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Get balance
      const balance = await tokenContract.balanceOf(holderAddress);
      
      // Convert to formatted balance
      const formattedBalance = parseFloat(ethers.formatUnits(balance, tokenDecimals));
      return formattedBalance;
    } catch (error) {
      retryCount++;
      
      if (retryCount <= MAX_RETRIES) {
        // Calculate backoff time: 500ms, 1000ms, 2000ms, etc.
        const backoffTime = 500 * Math.pow(2, retryCount - 1);
        
        if (verbose) {
          console.log(`Error fetching token balance for address ${holderAddress}, retry ${retryCount}/${MAX_RETRIES} after ${backoffTime}ms...`);
        }
        
        // Wait before retrying with exponential backoff
        await sleep(backoffTime);
      } else {
        console.error(`Failed to fetch token balance for address ${holderAddress} after ${MAX_RETRIES} retries:`, error);
      }
    }
  }
  
  // If all retries failed, return 0
  return 0;
}

/**
 * Fetch token balances for multiple addresses using ethers.js
 * @param tokenAddress The token contract address
 * @param tokenSymbol The token symbol
 * @param holderAddresses Array of addresses to check balances for
 * @param tokenDecimals The number of decimals for the token
 * @param verbose Whether to show verbose logs
 * @returns Array of token holders with their balances
 */
export async function fetchTokenBalancesWithEthers(
  tokenAddress: string,
  tokenSymbol: string,
  holderAddresses: string[],
  tokenDecimals: number,
  verbose: boolean = false
): Promise<any[]> {
  const holders: any[] = [];
  let processedCount = 0;
  
  if (verbose) console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses using ethers.js...`);
  
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  const MAX_BATCH_RETRIES = 2; // Max retries for entire batch failures
  
  for (let i = 0; i < holderAddresses.length; i += batchSize) {
    const batch = holderAddresses.slice(i, i + batchSize);
    let batchRetries = 0;
    let batchSuccess = false;
    
    while (!batchSuccess && batchRetries <= MAX_BATCH_RETRIES) {
      try {
        const batchPromises = batch.map(async (address) => {
          // Individual address balance fetching with retries is handled in fetchTokenBalanceWithEthers
          const balance = await fetchTokenBalanceWithEthers(tokenAddress, address, tokenDecimals, verbose);
          
          return {
            address,
            balance: ethers.parseUnits(balance.toString(), tokenDecimals).toString(),
            balanceFormatted: balance,
            tokenSymbol
          };
        });
        
        const batchResults = await Promise.all(batchPromises);
        holders.push(...batchResults);
        batchSuccess = true;
      } catch (error) {
        batchRetries++;
        if (batchRetries <= MAX_BATCH_RETRIES) {
          console.error(`Error processing batch (retry ${batchRetries}/${MAX_BATCH_RETRIES}):`, error);
          // Exponential backoff for batch retries
          const batchBackoffTime = 1000 * Math.pow(2, batchRetries - 1);
          if (verbose) console.log(`Retrying batch after ${batchBackoffTime}ms...`);
          await sleep(batchBackoffTime);
        } else {
          console.error(`Failed to process batch after ${MAX_BATCH_RETRIES} retries. Skipping batch.`);
          // Add empty results for this batch to maintain address count
          const emptyResults = batch.map(address => ({
            address,
            balance: "0",
            balanceFormatted: 0,
            tokenSymbol
          }));
          holders.push(...emptyResults);
        }
      }
    }
    
    processedCount += batch.length;
    if (processedCount % 20 === 0 || processedCount === holderAddresses.length) {
      if (verbose) console.log(`Processed ${processedCount}/${holderAddresses.length} addresses...`);
    }
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < holderAddresses.length) {
      const batchDelayTime = 500; // Base delay between batches
      if (verbose) console.log(`Waiting ${batchDelayTime}ms before next batch...`);
      await sleep(batchDelayTime);
    }
  }
  
  // Count non-zero balances for logging
  const nonZeroBalances = holders.filter(h => h.balanceFormatted > 0).length;
  if (verbose) console.log(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}
