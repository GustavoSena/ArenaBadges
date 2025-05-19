import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { NftHolder, TokenHolder } from '../types/interfaces';
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

const RETRY_DELAY = 500 ;


/**
 * Fetch NFT holders using sequential token ID scanning with robust error handling and retries
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
  verbose: boolean = false,
  nftSupply?: number 
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
    
    // Process in batches to avoid rate limiting
    const batchSize = 25;
    
    // Start checking token IDs from 0
    let tokenId = 0;
    let consecutiveFailures = 0;
    const MAX_TOKEN_ID = nftSupply ? nftSupply : 20000; // Safety limit
    const MAX_RETRIES = 5;
    
    while (tokenId <= MAX_TOKEN_ID && consecutiveFailures < batchSize) {
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
                
                if (verbose) console.log(`Token ${currentTokenId}: Owner ${ownerLower}`);
                
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
                
                if (isInvalidTokenId) {
                  // These are definitely invalid tokens, no need to retry
                  if (verbose) console.log(`Token ${currentTokenId}: Invalid token ID`);
                  return false;
                }
                else if (isRateLimited) {
                // Always retry rate limiting with a longer backoff
                retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    if (verbose) console.log(`Rate limit hit for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES} after ${RETRY_DELAY}ms...`);
                    await sleep(RETRY_DELAY * retryCount);
                  } else {
                    const errorMsg = `Failed to get owner for token ${currentTokenId} after ${MAX_RETRIES} retries due to rate limiting`;
                    console.error(errorMsg);
                    throw new Error(errorMsg);
                  }
                } else {
                  retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    if (verbose) console.log(`Error fetching owner for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES} after ${RETRY_DELAY}ms...`);
                    await sleep(RETRY_DELAY);
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
        if (verbose) console.log(`No valid tokens found in batch. Consecutive failures: ${consecutiveFailures}/${batchSize}`);
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
  const MAX_RETRIES = 5;
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
        
        if (verbose) {
          console.log(`Error fetching token balance for address ${holderAddress}, retry ${retryCount}/${MAX_RETRIES} after ${RETRY_DELAY}ms...`);
        }
        
        await sleep(RETRY_DELAY);
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
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
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
            holding: {
              tokenAddress: tokenAddress,
              tokenSymbol: tokenSymbol,
              tokenBalance: ethers.parseUnits(balance.toString(), tokenDecimals).toString(),
              tokenDecimals: tokenDecimals,
              balanceFormatted: balance
            }
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
            holding: {
              tokenAddress: tokenAddress,
              tokenSymbol: tokenSymbol,
              tokenBalance: "0",
              tokenDecimals: tokenDecimals,
              balanceFormatted: 0
            }
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
  const nonZeroBalances = holders.filter(h => h.holding.balanceFormatted > 0).length;
  if (verbose) console.log(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}
