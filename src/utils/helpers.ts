import * as fs from 'fs';
import { ethers } from 'ethers';

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
    return Number(balance) / Math.pow(10, decimals);
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
