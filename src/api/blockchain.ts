import { ethers } from 'ethers';
import { NftHolder, TokenHolder } from '../types/interfaces';
import { formatTokenBalance, sleep } from '../utils/helpers';
import logger from '../utils/logger';
import { AVALANCHE_RPC_URL, REQUEST_DELAY_MS } from '../types/constants';

let provider: ethers.Provider;

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

export function setupProvider(apiKey: string) {

  if (!apiKey) {
    logger.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching NFT holders.');
    return;
  }

  // Avalanche RPC URL using Alchemy API key
  provider = new ethers.JsonRpcProvider(`${AVALANCHE_RPC_URL}${apiKey}`);
}
/**
 * Fetch NFT holders using sequential token ID scanning with robust error handling and retries
 * @param contractAddress The NFT contract address
 * @param tokenName The name of the NFT
 * @param minBalance Minimum balance required (default: 1)
 * @returns Array of NFT holders
 */
export async function fetchNftHoldersFromEthers(
  contractAddress: string,
  tokenName: string,
  minBalance: number = 1,
  nftSupply?: number 
): Promise<NftHolder[]> {
  if (!provider) {
    logger.error('Provider not initialized. Please call setupProvider first.');
    throw new Error('Provider not initialized');
  }
  
  try {
    logger.verboseLog(`Fetching NFT holders for ${tokenName} (${contractAddress}) using sequential token ID scanning...`);
    
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
      logger.verboseLog(`Processing tokens ${tokenId} to ${tokenId + batchSize - 1}...`);
      
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
                
                logger.verboseLog(`Token ${currentTokenId}: Owner ${ownerLower}`);
                
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
                  logger.verboseLog(`Token ${currentTokenId}: Invalid token ID`);
                  return false;
                }
                else if (isRateLimited) {
                // Always retry rate limiting with a longer backoff
                retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    logger.verboseLog(`Rate limit hit for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES} after ${REQUEST_DELAY_MS}ms...`);
                    await sleep(REQUEST_DELAY_MS * retryCount);
                  } else {
                    const errorMsg = `Failed to get owner for token ${currentTokenId} after ${MAX_RETRIES} retries due to rate limiting`;
                    logger.error(errorMsg);
                    throw new Error(errorMsg);
                  }
                } else {
                  retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    logger.verboseLog(`Error fetching owner for token ${currentTokenId}, retry ${retryCount}/${MAX_RETRIES} after ${REQUEST_DELAY_MS}ms...`);
                    await sleep(REQUEST_DELAY_MS);
                  } else {
                    const errorMsg = `Failed to get owner for token ${currentTokenId} after ${MAX_RETRIES} retries: ${error instanceof Error ? error.message : String(error)}`;
                    logger.error(errorMsg);
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
        logger.verboseLog(`No valid tokens found in batch. Consecutive failures: ${consecutiveFailures}/${batchSize}`);
      } else {
        logger.verboseLog(`Found ${successCount} valid tokens in batch.`);
        consecutiveFailures = 0; // Reset counter if we found any valid tokens
      }
      
      // Move to the next batch
      tokenId += batchSize;
      
      // Add delay between batches to avoid rate limiting
      await sleep(REQUEST_DELAY_MS);
    }
    
    // Convert holder map to array
    const holders: NftHolder[] = Array.from(holderMap.entries())
      .filter(([_, count]) => count >= minBalance)
      .map(([address, count]) => ({
        address: address.toLowerCase(),
        holding: {
          tokenAddress: contractAddress,
          tokenSymbol: tokenName,
          tokenBalance: count.toString()
        }
      }));
    
    logger.log(`Found ${holders.length} holders with at least ${minBalance} ${tokenName}`);
    
    return holders;
  } catch (error) {
    logger.error(`Error fetching NFT holders for ${contractAddress}:`, error);
    
    // If this is a retry-related error, propagate it
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Failed to get owner') || 
        errorMessage.includes('after 5 retries') || 
        errorMessage.includes('max retries exceeded') || 
        errorMessage.includes('rate limit')) {
      throw new Error(`Retry failure in NFT holder fetching: ${errorMessage}`);
    }
    
    // For other errors, return empty array
    throw error;
  }
}

/**
 * Fetch token balance for a specific address using ethers.js
 * @param tokenAddress The token contract address
 * @param holderAddress The address to check balance for
 * @param tokenDecimals The number of decimals for the token
 * @returns Formatted token balance as a number
 */
export async function fetchTokenBalanceWithEthers(
  tokenAddress: string,
  holderAddress: string,
  tokenDecimals: number): Promise<number> {  
  if (!provider) {
    logger.error('Provider not initialized. Please call setupProvider first.');
    throw new Error('Provider not initialized');
  }
  const MAX_RETRIES = 5;
  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      // Create contract instance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Get balance
      const balance = await tokenContract.balanceOf(holderAddress);
      
      // Convert to formatted balance
      const formattedBalance = formatTokenBalance(balance, tokenDecimals);
      return formattedBalance;
    } catch (error) {
      retryCount++;
      
      if (retryCount <= MAX_RETRIES) {
        
        logger.verboseLog(`Error fetching token balance for address ${holderAddress}, retry ${retryCount}/${MAX_RETRIES} after ${REQUEST_DELAY_MS}ms...`);
        
        await sleep(REQUEST_DELAY_MS);
      } else {
        logger.error(`Failed to fetch token balance for address ${holderAddress} after ${MAX_RETRIES} retries:`, error);
        throw new Error(`Failed to fetch token balance for address ${holderAddress} after ${MAX_RETRIES} retries`);
      }
    }
  }
  
  throw new Error(`Failed to fetch token balance for address ${holderAddress} after ${MAX_RETRIES} retries`);
}

/**
 * Fetch token balances for multiple addresses using ethers.js
 * @param tokenAddress The token contract address
 * @param tokenSymbol The token symbol
 * @param holderAddresses Array of addresses to check balances for
 * @param tokenDecimals The number of decimals for the token
 * @returns Array of token holders with their balances
 */
export async function fetchTokenBalancesWithEthers(
  tokenAddress: string,
  tokenSymbol: string,
  holderAddresses: string[],
  tokenDecimals: number
): Promise<TokenHolder[]> {
  if (!provider) {
    logger.error('Provider not initialized. Please call setupProvider first.');
    throw new Error('Provider not initialized');
  }
  const holders: TokenHolder[] = [];
  
  logger.verboseLog(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses using ethers.js...`);
  
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  const MAX_BATCH_RETRIES = 3; // Max retries for entire batch failures
  
  for (let i = 0; i < holderAddresses.length; i += batchSize) {
    const batch = holderAddresses.slice(i, i + batchSize);
    let batchRetries = 0;
    let batchSuccess = false;
    
    while (!batchSuccess && batchRetries <= MAX_BATCH_RETRIES) {
      try {
        const batchPromises = batch.map(async (address) => {
          // Individual address balance fetching with retries is handled in fetchTokenBalanceWithEthers
          const balance = await fetchTokenBalanceWithEthers(tokenAddress, address, tokenDecimals);
          
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
          logger.error(`Error processing batch (retry ${batchRetries}/${MAX_BATCH_RETRIES}):`, error);
          logger.verboseLog(`Retrying batch after ${REQUEST_DELAY_MS}ms...`);
          await sleep(REQUEST_DELAY_MS);
        } else {
          logger.error(`Failed to process batch after ${MAX_BATCH_RETRIES} retries. Skipping batch.`);
          throw new Error(`Failed to process batch after ${MAX_BATCH_RETRIES} retries`);
        }
      }
    }

    // Add delay between batches to avoid rate limiting
    if (i + batchSize < holderAddresses.length) {
      logger.verboseLog(`Processed ${batchSize * i}/${holderAddresses.length} addresses...`);
      logger.verboseLog(`Waiting ${REQUEST_DELAY_MS}ms before next batch...`);
      await sleep(REQUEST_DELAY_MS);
    }
  }
  
  // Count non-zero balances for logging
  const nonZeroBalances = holders.filter(h => h.holding.balanceFormatted > 0).length;
  logger.verboseLog(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}
