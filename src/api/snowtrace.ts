import axios from 'axios';
import * as dotenv from 'dotenv';
import { TokenHolder } from '../types/interfaces';
import { sleep, formatTokenBalance } from '../utils/helpers';

// Load environment variables
dotenv.config();

/**
 * Fetch token holders using Snowtrace API
 */
export async function fetchTokenHoldersFromSnowtrace(
  tokenAddress: string, 
  tokenSymbol: string,
  minBalance: number,
  tokenDecimals: number
): Promise<TokenHolder[]> {
  try {
    console.log(`Fetching holders for ${tokenSymbol} (${tokenAddress}) from Snowtrace...`);
    
    const holders: TokenHolder[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMorePages = true;
    
    while (hasMorePages) {
      console.log(`Fetching page ${page} of token holders...`);
      
      // Construct the Snowtrace API URL
      const apiUrl = `https://api.snowtrace.io/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=${page}&offset=${pageSize}`;

      try {
        const response = await axios.get(apiUrl);
        
        if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
          const holdersData = response.data.result;
          
          // Process each holder
          for (const holderData of holdersData) {
            const address = holderData.TokenHolderAddress;
            const balance = holderData.TokenHolderQuantity;
            const balanceFormatted = formatTokenBalance(balance, tokenDecimals);
            
            // Only include holders with balance > MIN_TOKEN_BALANCE
            if (balanceFormatted >= minBalance) {
              holders.push({
                address,
                balance,
                balanceFormatted,
                tokenSymbol
              });
            }
          }
          
          // Check if we should fetch more pages
          if (holdersData.length < pageSize) {
            hasMorePages = false;
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
    
    // Sort holders by balance (descending)
    holders.sort((a, b) => b.balanceFormatted - a.balanceFormatted);
    
    console.log(`Found ${holders.length} holders with balance > ${minBalance} ${tokenSymbol}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching token holders for ${tokenAddress}:`, error);
    return [];
  }
}
