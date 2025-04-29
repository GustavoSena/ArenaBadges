import Moralis from 'moralis';
import * as dotenv from 'dotenv';
import { TokenHolder } from '../types/interfaces';
import { formatTokenBalance, sleep } from '../utils/helpers';

// Load environment variables
dotenv.config();

// Get Moralis API key from .env
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

if (!MORALIS_API_KEY) {
  console.warn('MORALIS_API_KEY not found in .env file. Required for fetching token holders.');
}

// Avalanche chain ID for Moralis API
const AVALANCHE_CHAIN_ID = '0xa86a';

/**
 * Initialize Moralis API
 */
async function initializeMoralis(): Promise<void> {
  if (!Moralis.Core.isStarted) {
    await Moralis.start({
      apiKey: MORALIS_API_KEY
    });
  }
}

/**
 * Fetch token holders from Moralis API
 * @param tokenAddress The contract address of the token
 * @param tokenSymbol The symbol of the token
 * @param tokenDecimals The number of decimals for the token
 * @returns Array of TokenHolder objects
 */
export async function fetchTokenHoldersFromMoralis(
  tokenAddress: string,
  tokenSymbol: string,
  tokenDecimals: number
): Promise<TokenHolder[]> {
  try {
    console.log(`Fetching holders for ${tokenSymbol} (${tokenAddress}) using Moralis API...`);
    
    // Initialize Moralis
    await initializeMoralis();
    
    const holders: TokenHolder[] = [];
    let cursor: string | undefined = '';
    let page = 1;
    
    // Fetch all pages of token holders
    do {
      console.log(`Fetching page ${page} of ${tokenSymbol} holders...`);
      
      try {
        const response = await Moralis.EvmApi.token.getTokenOwners({
          chain: AVALANCHE_CHAIN_ID,
          tokenAddress: tokenAddress,
          cursor: cursor || undefined,
          order: 'DESC'
        });
        
        const result = response.raw;
        
        // Process token holders from this page
        if (result && result.result) {
          // Handle both array and single object responses
          const holderResults = Array.isArray(result.result) ? result.result : [result.result];
          
          for (const holder of holderResults) {
            if (holder.owner_address && holder.balance) {
              // Format the balance
              const balanceFormatted = formatTokenBalance(holder.balance, tokenDecimals);
              
              holders.push({
                address: holder.owner_address.toLowerCase(),
                balance: holder.balance,
                balanceFormatted,
                tokenSymbol
              });
            }
          }
        }
        
        // Update cursor for next page
        cursor = result.cursor;
        page++;
        
        // Add delay to avoid rate limiting
        await sleep(500);
        
      } catch (error) {
        console.error(`Error fetching page ${page} of ${tokenSymbol} holders:`, error);
        break;
      }
      
    } while (cursor && cursor !== '');
    
    console.log(`Found ${holders.length} ${tokenSymbol} holders`);
    
    return holders;
  } catch (error) {
    console.error(`Error fetching token holders for ${tokenAddress}:`, error);
    return [];
  }
}

/**
 * Fetch token balance for a specific address using Moralis API
 * @param tokenAddress The contract address of the token
 * @param holderAddress The address to check the balance for
 * @param tokenDecimals The number of decimals for the token
 * @returns The formatted token balance
 */
export async function fetchTokenBalanceWithMoralis(
  tokenAddress: string,
  holderAddress: string,
  tokenDecimals: number
): Promise<number> {
  try {
    // Initialize Moralis
    await initializeMoralis();
    
    const response = await Moralis.EvmApi.token.getWalletTokenBalances({
      chain: AVALANCHE_CHAIN_ID,
      address: holderAddress,
      tokenAddresses: [tokenAddress]
    });
    
    const balances = response.raw;
    
    if (balances && balances.length > 0) {
      const tokenBalance = balances.find(b => b.token_address.toLowerCase() === tokenAddress.toLowerCase());
      if (tokenBalance) {
        return formatTokenBalance(tokenBalance.balance, tokenDecimals);
      }
    }
    
    return 0;
  } catch (error) {
    console.error(`Error fetching token balance for address ${holderAddress}:`, error);
    return 0;
  }
}

/**
 * Fetch token balances for multiple addresses using Moralis API
 * @param tokenAddress The contract address of the token
 * @param tokenSymbol The symbol of the token
 * @param holderAddresses Array of addresses to check balances for
 * @param tokenDecimals The number of decimals for the token
 * @returns Array of TokenHolder objects with balances
 */
export async function fetchTokenBalancesWithMoralis(
  tokenAddress: string,
  tokenSymbol: string,
  holderAddresses: string[],
  tokenDecimals: number
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
  let processedCount = 0;
  
  console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses using Moralis API...`);
  
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
          const balanceFormatted = await fetchTokenBalanceWithMoralis(tokenAddress, address, tokenDecimals);
          
          return {
            address,
            balance: (balanceFormatted * Math.pow(10, tokenDecimals)).toString(),
            balanceFormatted,
            tokenSymbol
          };
        } catch (error) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Error fetching balance for ${address}. Retry ${retryCount}/${MAX_RETRIES}...`);
            // Add a small delay before retrying
            await sleep(1000);
          } else {
            console.error(`Failed after ${MAX_RETRIES} retries for address ${address}`);
            return {
              address,
              balance: "0",
              balanceFormatted: 0,
              tokenSymbol
            };
          }
        }
      }
      
      // This should never be reached but TypeScript needs it
      return {
        address,
        balance: "0",
        balanceFormatted: 0,
        tokenSymbol
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    holders.push(...batchResults);
    
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
  const nonZeroBalances = holders.filter(h => h.balanceFormatted > 0).length;
  console.log(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}
