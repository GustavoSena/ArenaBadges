import axios from 'axios';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { TokenHolder } from '../types/interfaces';
import { sleep, formatTokenBalance } from '../utils/helpers';

// Load environment variables
dotenv.config();

/**
 * Fetch token holders using Snowtrace API
 * @param tokenAddress The token contract address
 * @param tokenSymbol The token symbol (optional, will use 'Unknown Token' if not provided)
 * @param minBalance Minimum balance required (default: 0)
 * @param tokenDecimals Token decimals for formatting (optional)
 * @returns Array of token holders
 */
export async function fetchTokenHoldersFromSnowtrace(
  tokenAddress: string, 
  tokenSymbol?: string,
  minBalance: number = 0,
  tokenDecimals?: number
): Promise<TokenHolder[]> {
  try {
    // Use default token symbol if not provided
    const symbol = tokenSymbol || 'Unknown Token';
    console.log(`Fetching holders for ${symbol} (${tokenAddress}) from Snowtrace...`);
    
    // Check if we have an API key for Snowtrace
    const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || '';
    if (!SNOWTRACE_API_KEY) {
      console.warn('No SNOWTRACE_API_KEY found in .env file. API rate limits may be lower.');
    }
    
    const holders: TokenHolder[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMorePages = true;
    const MAX_PAGES = 5; // Limit to 5 pages to avoid excessive API calls
    
    while (hasMorePages && page <= MAX_PAGES) {
      console.log(`Fetching page ${page} of token holders...`);
      
      // Construct the Snowtrace API URL with API key if available
      const apiUrl = `https://api.snowtrace.io/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=${page}&offset=${pageSize}${SNOWTRACE_API_KEY ? `&apikey=${SNOWTRACE_API_KEY}` : ''}`;
      
      console.log(`Making request to: ${apiUrl.replace(/apikey=([^&]*)/, 'apikey=***')}`);

      try {
        const response = await axios.get(apiUrl);
        console.log(`Response status: ${response.status}`);
        console.log(`Response data status: ${response.data.status}`);
        console.log(`Response data message: ${response.data.message}`);
        console.log(`Response data result length: ${response.data.result ? response.data.result.length : 'undefined'}`);
        
        if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
          const holdersData = response.data.result;
          let belowMinimumBalanceFound = false;
          
          // Process each holder
          for (const holderData of holdersData) {
            const address = holderData.address || holderData.TokenHolderAddress;
            const balance = holderData.value || holderData.TokenHolderQuantity;
            
            // Format the balance - handle optional tokenDecimals
            let balanceFormatted: number;
            if (typeof tokenDecimals === 'number') {
              balanceFormatted = formatTokenBalance(balance, tokenDecimals);
            } else {
              // If tokenDecimals is not provided, try to parse the balance as a number
              balanceFormatted = parseFloat(ethers.formatUnits(balance, 18)); // Default to 18 decimals
            }
            
            // Only include holders with balance >= minBalance
            if (balanceFormatted >= minBalance) {
              holders.push({
                address,
                balance,
                balanceFormatted,
                tokenSymbol: symbol
              });
            } else {
              // Since results are ordered by balance, once we find one holder below
              // the minimum, we can stop processing
              belowMinimumBalanceFound = true;
              break;
            }
          }
          
          // Check if we should fetch more pages
          if (holdersData.length < pageSize || belowMinimumBalanceFound) {
            hasMorePages = false;
            if (belowMinimumBalanceFound) {
              console.log(`Stopped fetching at page ${page} - found holder below minimum balance of ${minBalance} ${symbol}`);
            }
          } else {
            page++;
            // Add delay between pages to avoid rate limiting
            await sleep(1000);
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error fetching token holders page ${page}:`, error);
        hasMorePages = false;
      }
    }
    
    // Sort holders by balance (descending) - though they should already be sorted
    holders.sort((a, b) => b.balanceFormatted - a.balanceFormatted);
    
    console.log(`Found ${holders.length} holders with balance >= ${minBalance} ${tokenSymbol}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching token holders for ${tokenAddress}:`, error);
    return [];
  }
}
