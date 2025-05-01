import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

/**
 * Application configuration interface
 */
export interface AppConfig {
  tokens: {
    symbol: string;
    address: string;
    minBalance: number;
    decimals: number;
  }[];
  nfts: {
    name: string;
    address: string;
    minBalance: number;
  }[];
  scheduler: {
    intervalHours: number;
  };
  api: {
    baseUrl: string;
    endpoints: {
      nftOnly: string;
      combined: string;
    };
  };
}

/**
 * Sleep function to introduce delay between API requests
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format token balance with proper decimals
 * Safely handles cases where decimals might be too large for ethers.formatUnits
 * or when decimals is not an integer
 */
export function formatTokenBalance(balance: string, decimals: number): number {
  try {
    // Ensure decimals is an integer for ethers.js
    const decimalPlaces = Math.floor(decimals);
    
    // Ethers.js has a limit on the number of decimals it can handle
    // For large decimal values, we'll use a safer approach
    if (decimalPlaces > 77) {
      // For very large decimals, manually shift the decimal point
      const balanceBN = BigInt(balance);
      const divisor = BigInt(10) ** BigInt(decimalPlaces);
      
      // Calculate the integer part
      const integerPart = balanceBN / divisor;
      
      // Calculate the fractional part with precision
      const fractionalPart = balanceBN % divisor;
      const fractionalStr = fractionalPart.toString().padStart(decimalPlaces, '0');
      
      // Combine integer and fractional parts
      return Number(`${integerPart}.${fractionalStr}`);
    } else {
      // Use ethers.formatUnits for normal cases
      return parseFloat(ethers.formatUnits(balance, decimalPlaces));
    }
  } catch (error) {
    console.warn(`Error formatting balance ${balance} with ${decimals} decimals:`, error);
    // Fallback to a simple division approach
    return Number(balance) / Math.pow(10, Math.floor(decimals));
  }
}

/**
 * Load configuration from file
 */
export function loadConfig(): AppConfig {
  const configPath = path.join(process.cwd(), 'config', 'tokens.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as AppConfig;
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
