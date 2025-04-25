import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import { AppConfig } from '../types/interfaces';

/**
 * Sleep function to introduce delay between API requests
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format token balance with proper decimals
 */
export function formatTokenBalance(balance: string, decimals: number): number {
  return parseFloat(ethers.formatUnits(balance, decimals));
}

/**
 * Load configuration from file
 */
export function loadConfig(): AppConfig {
  const configPath = path.join(__dirname, '../../config/tokens.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
