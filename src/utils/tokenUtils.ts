// Token utility functions
import { TokenConfig, TokenHolding } from '../types/interfaces';
import { getTokensBalance } from '../api/alchemy';
import { fetchTokenBalance } from './helpers';
import logger from './logger';

/**
 * Updates the token holdings map with a new holding
 * @param map Current token holdings map
 * @param tokenAddress Token address (lowercase)
 * @param holding Token holding to add or update
 * @param shouldSum Whether to sum balances or take the max
 * @param walletAddress Wallet address for logging
 * @returns Updated token holdings map
 */
export function updateTokenHoldingsMap(
  map: {[key: string]: TokenHolding}, 
  tokenAddress: string, 
  holding: TokenHolding, 
  shouldSum: boolean,
  walletAddress: string
): {[key: string]: TokenHolding} {
  const updatedMap = {...map};
  
  if (updatedMap[tokenAddress]) {
    if (shouldSum) {
      logger.verboseLog(`Adding token holding for ${tokenAddress} for wallet ${walletAddress}: ${holding.balanceFormatted}`);
      updatedMap[tokenAddress].balanceFormatted = updatedMap[tokenAddress].balanceFormatted! + holding.balanceFormatted;
    } else {
      if (holding.balanceFormatted > updatedMap[tokenAddress].balanceFormatted!) {
        updatedMap[tokenAddress] = holding;
      }
    }
  } else {
    updatedMap[tokenAddress] = holding;
  }
  
  logger.verboseLog(`Updated token holding for ${tokenAddress} for wallet ${walletAddress}: ${updatedMap[tokenAddress]?.balanceFormatted}`);
  return updatedMap;
}

/**
 * Creates a TokenHolding object from a token config and balance
 * @param config Token configuration
 * @param balance Token balance
 * @returns TokenHolding object
 */
export function createTokenHolding(config: TokenConfig, balance: number): TokenHolding {
  return {
    tokenAddress: config.address,
    tokenSymbol: config.symbol,
    tokenBalance: balance.toString(),
    tokenDecimals: config.decimals,
    balanceFormatted: balance
  };
}

/**
 * Converts a hex balance to a decimal number with proper decimals
 * @param hexBalance Hex balance string
 * @param decimals Number of decimals
 * @returns Formatted balance as a number
 */
export function convertHexBalance(hexBalance: string | null, decimals: number): number {
  return hexBalance ? parseInt(hexBalance, 16) / Math.pow(10, decimals) : 0;
}

/**
 * Process token balances in batch using Alchemy API
 * @param walletAddress The wallet address to check balances for
 * @param missingTokens Array of token configs to check
 * @param tokenHoldingsMap Current token holdings map
 * @param sumOfBalances Whether to sum balances or take the max
 * @returns Updated token holdings map
 */
export async function processTokenBalances(
  walletAddress: string,
  missingTokens: TokenConfig[],
  tokenHoldingsMap: {[key: string]: TokenHolding},
  sumOfBalances: boolean
): Promise<{[key: string]: TokenHolding}> {
  let updatedMap = {...tokenHoldingsMap};
  
  if (missingTokens.length === 0) {
    return updatedMap;
  }
  
  logger.verboseLog(`Batch fetching balances for ${missingTokens.length} tokens for address ${walletAddress}...`);
  
  try {
    const tokenAddresses = missingTokens.map(config => config.address);
    const balanceResults = await getTokensBalance(walletAddress, tokenAddresses);
    
    logger.verboseLog(`Received batch balance results for ${walletAddress}`);
    
    // Process the results
    for (let i = 0; i < missingTokens.length; i++) {
      const config = missingTokens[i];
      const tokenAddress = config.address.toLowerCase();
      const tokenBalance = balanceResults.tokenBalances[i];
      
      // Convert the balance to the correct format with decimals
      const balanceValue = convertHexBalance(tokenBalance.tokenBalance, config.decimals);
      
      logger.verboseLog(`Processed token balance for ${tokenAddress}: ${balanceValue}`);
      
      // Only add if balance is greater than 0
      if (balanceValue > 0) {
        updatedMap = updateTokenHoldingsMap(
          updatedMap, 
          tokenAddress, 
          createTokenHolding(config, balanceValue), 
          sumOfBalances, 
          walletAddress
        );
      }
    }
    
    return updatedMap;
  } catch (error) {
    logger.error(`Error batch fetching token balances for ${walletAddress}:`, error);
    
    // Fallback to individual fetching if batch fails
    logger.verboseLog(`Falling back to individual token balance fetching for ${walletAddress}`);
    
    for (const config of missingTokens) {
      const tokenAddress = config.address.toLowerCase();
      logger.verboseLog(`Fetching token balance for ${tokenAddress} for address ${walletAddress}...`);
      
      try {
        const balance = await fetchTokenBalance(
          config.address,
          walletAddress,
          config.decimals
        );
        
        logger.verboseLog(`Fetched token balance for ${tokenAddress} for address ${walletAddress}: ${balance}`);
        
        // Only add if balance is greater than 0
        if (balance > 0) {
          updatedMap = updateTokenHoldingsMap(
            updatedMap, 
            tokenAddress, 
            createTokenHolding(config, balance), 
            sumOfBalances, 
            walletAddress
          );
        }
      } catch (fetchError) {
        logger.error(`Error fetching individual token balance for ${tokenAddress}:`, fetchError);
        throw fetchError;
      }
    }
    
    return updatedMap;
  }
}
