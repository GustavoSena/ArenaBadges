import * as fs from 'fs';
import { ethers } from 'ethers';
import { TokenHolder } from '../types/interfaces';
import { fetchTokenBalanceWithMoralis, fetchTokenHoldersFromMoralis } from '../api/moralis';
import { fetchTokenHoldersFromSnowtrace } from '../api/snowtrace';
import { fetchTokenBalanceWithEthers } from '../api/blockchain';
import logger from './logger';


/**
 * Sleep function to introduce delay between API requests
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format token balance with proper decimals
 * Safely handles cases where decimals might be too large for ethers.formatUnits
 * or when decimals is not an integer
 */
export function formatTokenBalance(balance: string, decimals: number = 18): number {
  try {
    return parseFloat(ethers.formatUnits(balance, decimals));
  } catch (error) {
    logger.error(`Error formatting balance ${balance} with ${decimals} decimals:`, error);
    return +balance / Math.pow(10, decimals);
  }
}

/**
 * Ensure output directory exists
 */
export function ensureOutputDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Save data to JSON file
 */
export function saveToJsonFile(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function fetchTokenHolders(
  tokenAddress: string, 
  tokenSymbol: string,
  minBalance: number = 0,
  tokenDecimals: number
): Promise<TokenHolder[]> {
  let tokenHolders: TokenHolder[] = [];
  try{
    logger.log(`Fetching token holders for ${tokenAddress} from Moralis...`);
    tokenHolders = await fetchTokenHoldersFromMoralis(tokenAddress, tokenSymbol, tokenDecimals, minBalance);
  }catch(error){
    logger.error(`Error fetching token holders for ${tokenAddress}:`, error);
    try {
      logger.log(`Fetching token holders for ${tokenAddress} from Snowtrace...`);
      tokenHolders = await fetchTokenHoldersFromSnowtrace(tokenAddress, tokenSymbol, minBalance, tokenDecimals);
    } catch (error) {
      logger.error(`Error fetching token holders for ${tokenAddress}:`, error);
      throw error;
    }
  }
  return tokenHolders;
}

/**
 * Fetch token balance for a specific address using Moralis API with key rotation
 * Using direct API calls instead of the SDK
 * @param tokenAddress The token contract address
 * @param holderAddress The holder address
 * @param tokenDecimals The token decimals
 * @returns The token balance
 */
export async function fetchTokenBalance(
  tokenAddress: string,
  holderAddress: string,
  tokenDecimals: number
): Promise<number> {
  try {
    logger.log(`Fetching token balance for ${tokenAddress} for address ${holderAddress}...`);
    const balance = await fetchTokenBalanceWithEthers(tokenAddress, holderAddress, tokenDecimals);
    return balance;
  } catch (error) {
    logger.error(`Error fetching token balance for ${tokenAddress} for address ${holderAddress} with ethers, try with Moralis`);
    try {
      logger.verboseLog(`Fetching token balance for ${tokenAddress} for address ${holderAddress}...`);
      const balance = await fetchTokenBalanceWithMoralis(tokenAddress, holderAddress, tokenDecimals);
      return balance;
    } catch (error) {
      logger.error(`Error fetching token balance for ${tokenAddress} for address ${holderAddress}:`, error);
      throw error;
    }
  }
}