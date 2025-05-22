import { TokenHolder } from '../types/interfaces';
import { formatTokenBalance, sleep } from '../utils/helpers';
import axios from 'axios';

let MORALIS_API_KEYS: string[] = [];


export function setupMoralisProvider(apiKey: string) {

  if (!apiKey) {
    console.warn('MORALIS_API_KEYS not found in .env file. Required for fetching NFT holders.');
    return;
  }

  try {
    // Try to parse as JSON array
    if (apiKey.trim().startsWith('[')) {
      MORALIS_API_KEYS = JSON.parse(apiKey);
    }
  } catch (error) {
    console.error('Error parsing MORALIS_API_KEYS:', error);
    // Fallback to treating as a single key
    if (apiKey.trim() !== '') {
      MORALIS_API_KEYS = [apiKey];
    }
  }
  
  if (MORALIS_API_KEYS.length === 0) {
    console.warn('No MORALIS_API_KEYS found in .env file. Required for fetching token holders.');
  } else {
    console.log(`Loaded ${MORALIS_API_KEYS.length} Moralis API keys.`);
  }

}

// Avalanche chain ID for Moralis API
const AVALANCHE_CHAIN_ID = '0xa86a';

// Track the current key index
let currentKeyIndex = 0;
let hasRotatedThroughAllKeys = false;

/**
 * Get the current Moralis API key
 */
function getCurrentMoralisApiKey(): string {
  if (MORALIS_API_KEYS.length === 0) {
    throw new Error('No Moralis API keys available');
  }
  return MORALIS_API_KEYS[currentKeyIndex];
}

/**
 * Rotate to the next Moralis API key
 * @returns True if successfully rotated to a new key, false if we've gone through all keys
 */
function rotateToNextMoralisApiKey(): boolean {
  if (MORALIS_API_KEYS.length <= 1) {
    hasRotatedThroughAllKeys = true;
    return false;
  }
  
  // Move to the next key
  currentKeyIndex = (currentKeyIndex + 1) % MORALIS_API_KEYS.length;
  
  // If we've gone back to the first key, set the flag
  if (currentKeyIndex === 0) {
    hasRotatedThroughAllKeys = true;
    return false;
  }
  
  console.log(`Rotating to Moralis API key #${currentKeyIndex + 1}`);
  return true;
}

/**
 * Make a direct API call to Moralis using the current key
 * This bypasses the Moralis SDK to allow key rotation
 */
async function callMoralisApi(endpoint: string, params: any, verbose: boolean = false): Promise<any> {
  const apiKey = getCurrentMoralisApiKey();
  const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
  const url = `${baseUrl}${endpoint}`;
  
  try {
    if (verbose) {
      console.log(`Making direct API call to Moralis with key #${currentKeyIndex + 1}`);
    }
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey
      }
    });
    
    return response.data;
  } catch (error: any) {
    // Check if this is a quota exceeded error (401 Unauthorized)
    if (error.response && error.response.status === 401) {
      console.warn(`Moralis API quota exceeded for key #${currentKeyIndex + 1}`);
      
      // Try to rotate to the next key
      const rotated = rotateToNextMoralisApiKey();
      
      if (!rotated && hasRotatedThroughAllKeys) {
        console.error('All Moralis API keys have exceeded their quota. Cannot continue.');
        throw new Error('All Moralis API keys have exceeded their quota');
      }
      
      // Retry with the new key
      if (verbose) {
        console.log(`Retrying API call with key #${currentKeyIndex + 1}`);
      }
      return callMoralisApi(endpoint, params, verbose);
    }
    
    // For other errors, just throw
    throw error;
  }
}

/**
 * Fetch token holders from Moralis API with key rotation
 * Using direct API calls instead of the SDK
 */
export async function fetchTokenHoldersFromMoralis(
  tokenAddress: string,
  tokenSymbol: string,
  tokenDecimals: number,
  minBalance: number = 0,
  verbose: boolean = false
): Promise<TokenHolder[]> {
  if (MORALIS_API_KEYS.length === 0) {
    console.warn('No Moralis API keys available. Skipping Moralis token holder fetch.');
    throw new Error('No Moralis API keys available');
  }
  
  try {
    if (verbose) {
      console.log(`Fetching holders for ${tokenSymbol} (${tokenAddress}) using Moralis API...`);
    } else {
      console.log(`Fetching ${tokenSymbol} token holders...`);
    }
    
    const holders: TokenHolder[] = [];
    let cursor: string | undefined = undefined;
    let page = 1;
    let shouldContinue = true;
    
    // Fetch all pages of token holders
    do {
      if (verbose) {
        console.log(`Fetching page ${page} of ${tokenSymbol} holders with key #${currentKeyIndex + 1}...`);
      }
      
      try {
        const params: any = {
          chain: AVALANCHE_CHAIN_ID,
          limit: 50,
          order: 'DESC'
        };
        
        if (cursor) {
          params.cursor = cursor;
        }
        
        const responseData = await callMoralisApi(`/erc20/${tokenAddress}/owners`, params, verbose);
        
        // Process token holders from this page
        if (responseData && responseData.result) {
          // Handle both array and single object responses
          const holderResults = Array.isArray(responseData.result) ? responseData.result : [responseData.result];
          
          if (holderResults.length === 0) {
            console.log('No more holders found.');
            break;
          }
          
          // Track if we found any holders above the minimum balance
          let foundQualifyingHolder = false;
          
          for (const holder of holderResults) {
            if (holder.owner_address && holder.balance) {
              // Format the balance
              const balanceFormatted = formatTokenBalance(holder.balance, tokenDecimals);
              
              // Check if this holder meets the minimum balance requirement
              if (balanceFormatted >= minBalance) {
                foundQualifyingHolder = true;
                if (verbose) console.log(`Holder ${holder.owner_address} has the balance ${balanceFormatted} which is above the minimum balance of ${minBalance} ${tokenSymbol}`);
                holders.push({
                  address: holder.owner_address.toLowerCase(),
                  holding: {
                    tokenAddress: tokenAddress,
                    tokenSymbol: tokenSymbol,
                    tokenBalance: holder.balance,
                    tokenDecimals: tokenDecimals,
                    balanceFormatted: balanceFormatted
                  }
                });
              }
            }
          }
          
          // Check if the last holder in this page meets the minimum balance
          // If not, we can stop fetching more pages since they're ordered by balance DESC
          const lastHolder = holderResults[holderResults.length - 1];
          if (lastHolder && lastHolder.balance) {
            const lastHolderBalance = formatTokenBalance(lastHolder.balance, tokenDecimals);
            
            if (lastHolderBalance < minBalance) {
              console.log(`Last holder's balance (${lastHolderBalance}) is below minimum (${minBalance}). Stopping pagination.`);
              shouldContinue = false;
            }
          }
          
          // If we didn't find any qualifying holders in this page, and we're paginating by balance DESC,
          // we can stop fetching more pages
          if (!foundQualifyingHolder && minBalance > 0) {
            console.log(`No qualifying holders found in this page. Stopping pagination.`);
            shouldContinue = false;
          }
          
          // Update cursor for next page
          cursor = responseData.cursor;
          
          // If there's no cursor or it's empty, we've reached the end
          if (!cursor) {
            shouldContinue = false;
          }
        } else {
          // No results or invalid response
          shouldContinue = false;
        }
        
        // Increment page counter
        page++;
        
        // Add a small delay between pages to avoid rate limiting
        if (shouldContinue) {
          await sleep(500);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('All Moralis API keys have exceeded their quota')) {
          throw error;
        }
        
        console.error(`Error fetching page ${page} of ${tokenSymbol} holders:`, error);
        shouldContinue = false;
      }
    } while (shouldContinue);
    
    console.log(`Found ${holders.length} ${tokenSymbol} holders with minimum balance of ${minBalance}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching ${tokenSymbol} holders:`, error);
    throw error;
  }
}

/**
 * Fetch token balance for a specific address using Moralis API with key rotation
 * Using direct API calls instead of the SDK
 */
export async function fetchTokenBalanceWithMoralis(
  tokenAddress: string,
  holderAddress: string,
  tokenDecimals: number,
  verbose: boolean = false
): Promise<number> {
  if (MORALIS_API_KEYS.length === 0) {
    console.warn('No Moralis API keys available. Skipping Moralis token balance fetch.');
    throw new Error('No Moralis API keys available');
  }
  
  try {
    const params = {
      chain: AVALANCHE_CHAIN_ID
    };
    
    const responseData = await callMoralisApi(`/${holderAddress}/erc20`, params, verbose);
    
    if (responseData && Array.isArray(responseData)) {
      const tokenBalance = responseData.find((b: any) => b.token_address.toLowerCase() === tokenAddress.toLowerCase());
      if (tokenBalance) {
        return formatTokenBalance(tokenBalance.balance, tokenDecimals);
      }
    }
    
    return 0;
  } catch (error) {
    
    console.error(`Error fetching token balance for address ${holderAddress}:`, error);
    throw error;
  }
}

/**
 * Fetch token balances for multiple addresses using Moralis API with key rotation
 * Using direct API calls instead of the SDK
 */
export async function fetchTokenBalancesWithMoralis(
  tokenAddress: string,
  tokenSymbol: string,
  holderAddresses: string[],
  tokenDecimals: number,
  verbose: boolean = false
): Promise<TokenHolder[]> {
  if (MORALIS_API_KEYS.length === 0) {
    console.warn('No Moralis API keys available. Skipping Moralis token balances fetch.');
    throw new Error('No Moralis API keys available');
  }
  
  const holders: TokenHolder[] = [];
  let processedCount = 0;
  
  if (verbose) {
    console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses using Moralis API...`);
  } else {
    console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses...`);
  }
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < holderAddresses.length; i += batchSize) {
    const batch = holderAddresses.slice(i, i + batchSize);
    const batchPromises = batch.map(async (address) => {
      // Add retry mechanism
      const MAX_RETRIES = 3;
      let retryCount = 0;
      
      while (retryCount <= MAX_RETRIES) {
        try {
          const balanceFormatted = await fetchTokenBalanceWithMoralis(tokenAddress, address, tokenDecimals, verbose);
          
          return {
            address,
            holding: {
              tokenAddress: tokenAddress,
              tokenSymbol: tokenSymbol,
              tokenBalance: (balanceFormatted * Math.pow(10, tokenDecimals)).toString(),
              tokenDecimals: tokenDecimals,
              balanceFormatted: balanceFormatted
            }
          };
        } catch (error) {
          // Check if this is a quota exceeded error that we've already tried to handle
          if (error instanceof Error && error.message.includes('All Moralis API keys have exceeded their quota')) {
            throw error; // Propagate this error up
          }
          
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Error fetching balance for ${address}. Retry ${retryCount}/${MAX_RETRIES}...`);
            // Add a small delay before retrying
            await sleep(1000);
          } else {
            console.error(`Failed after ${MAX_RETRIES} retries for address ${address}`);
            throw error;
          }
        }
      }
      
      // This should never be reached but TypeScript needs it
      return {
        address,
        holding: {
          tokenAddress: tokenAddress,
          tokenSymbol: tokenSymbol,
          tokenBalance: "0",
          tokenDecimals: tokenDecimals,
          balanceFormatted: 0
        }
      };
    });
    
    try {
      const batchResults = await Promise.all(batchPromises);
      holders.push(...batchResults);
    } catch (error) {
      
      console.error(`Error processing batch:`, error);
      throw error;
    }
    
    processedCount += batch.length;
    if (processedCount % 20 === 0 || processedCount === holderAddresses.length) {
      console.log(`Processed ${processedCount}/${holderAddresses.length} addresses...`);
    }
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < holderAddresses.length) {
      await sleep(1000);
    }
  }
  
  // Count non-zero balances for logging
  const nonZeroBalances = holders.filter(h => h.holding.balanceFormatted! > 0).length;
  console.log(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}
