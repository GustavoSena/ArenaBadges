import axios from 'axios';
import { TokenHolder } from '../types/interfaces';
import { sleep, formatTokenBalance } from '../utils/helpers';

let snowtraceApiKey: string = '';

export function setupSnowtraceProvider(apiKey: string) {

  if (!apiKey) {
    console.warn('SNOWTRACE_API_KEY not found in .env file. Required for fetching NFT holders.');
    return;
  }

  snowtraceApiKey = apiKey;
}

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
  tokenDecimals: number = 18,
  verbose: boolean = false
): Promise<TokenHolder[]> {
  try {
    // Use default token symbol if not provided
    const symbol = tokenSymbol || 'Unknown Token';
    console.log(`Fetching holders for ${symbol} (${tokenAddress}) from Snowtrace...`);
    
    // Check if we have an API key for Snowtrace
    if (!snowtraceApiKey) {
      console.warn('No SNOWTRACE_API_KEY found in .env file. API rate limits may be lower.');
    }
    
    const holders: TokenHolder[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMorePages = true;
    let consecutiveLowBalanceHolders = 0;
    
    while (hasMorePages) {
      console.log(`Fetching page ${page} of token holders...`);
      
      // Construct the Snowtrace API URL with API key if available
      const apiUrl = `https://api.snowtrace.io/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=${page}&offset=${pageSize}${snowtraceApiKey ? `&apikey=${snowtraceApiKey}` : ''}`;
      
      if (verbose) console.log(`Making request to: ${apiUrl.replace(/apikey=([^&]*)/, 'apikey=***')}`);

      try {
        const response = await axios.get(apiUrl);
        if (verbose) {
          console.log(`Response status: ${response.status}`);
          console.log(`Response data status: ${response.data.status}`);
          console.log(`Response data message: ${response.data.message}`);
          console.log(`Response data result length: ${response.data.result ? response.data.result.length : 'undefined'}`);
        }
        
        if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
          const holdersData = response.data.result;
          
          // Process each holder
          let lowBalanceInThisPage = 0;
          
          for (const holderData of holdersData) {
            const address = holderData.address || holderData.TokenHolderAddress;
            const balance = holderData.value || holderData.TokenHolderQuantity;
                   
            let balanceFormatted = formatTokenBalance(balance, tokenDecimals);
            
            // Check if holder meets minimum balance requirement
            if (balanceFormatted >= minBalance) {
              // Reset consecutive low balance counter when we find a valid holder
              consecutiveLowBalanceHolders = 0;
              
              holders.push({
                address,
                holding: {
                  tokenAddress: tokenAddress,
                  tokenSymbol: symbol,
                  tokenBalance: balance,
                  tokenDecimals: tokenDecimals,
                  balanceFormatted: balanceFormatted
                }
              });
            } else {
              // Increment consecutive low balance counter
              consecutiveLowBalanceHolders++;
              lowBalanceInThisPage++;
              
              // Stop if we've found 3 consecutive holders with low balance
              if (consecutiveLowBalanceHolders >= 3) {
                console.log(`Found 3 consecutive holders with balance < ${minBalance}, stopping search`);
                hasMorePages = false;
                break;
              }
            }
          }
          
          // Log how many holders were skipped in this page
          if (lowBalanceInThisPage > 0) {
            console.log(`Skipped ${lowBalanceInThisPage} holders with balance < ${minBalance} on page ${page}`);
          }
          
          // Check if we should fetch more pages
          if (holdersData.length < pageSize) {
            console.log(`Reached end of results at page ${page} (fewer results than page size)`);
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
    holders.sort((a, b) => b.holding.balanceFormatted - a.holding.balanceFormatted);
    
    console.log(`Found ${holders.length} holders with balance >= ${minBalance} ${tokenSymbol}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching token holders for ${tokenAddress}:`, error);
    return [];
  }
}
