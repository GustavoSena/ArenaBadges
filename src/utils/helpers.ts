import * as fs from 'fs';
import { ethers } from 'ethers';
import { TokenHolder } from '../types/interfaces';
import { fetchTokenHoldersFromMoralis } from '../api/moralis';
import { fetchTokenHoldersFromSnowtrace } from '../api/snowtrace';


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
    console.warn(`Error formatting balance ${balance} with ${decimals} decimals:`, error);
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
  tokenDecimals: number,
  verbose: boolean = false
): Promise<TokenHolder[]> {
  let tokenHolders: TokenHolder[] = [];
  try{
    console.log(`Fetching token holders for ${tokenAddress} from Moralis...`);
    tokenHolders = await fetchTokenHoldersFromMoralis(tokenAddress, tokenSymbol, tokenDecimals, minBalance, verbose);
  }catch(error){
    console.error(`Error fetching token holders for ${tokenAddress}:`, error);
    try {
      console.log(`Fetching token holders for ${tokenAddress} from Snowtrace...`);
      tokenHolders = await fetchTokenHoldersFromSnowtrace(tokenAddress, tokenSymbol, minBalance, tokenDecimals, verbose);
    } catch (error) {
      console.error(`Error fetching token holders for ${tokenAddress}:`, error);
      return [];
    }
  }
  return tokenHolders;
}