import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ArenaWalletResponse } from '../types/interfaces';
import logger from './logger';

/**
 * Load wallet-to-twitter mapping from a JSON file
 * @param filename The name of the mapping file (relative to config directory)
 * @param projectId Optional project ID for project-specific mappings
 * @returns A record mapping wallet addresses to Twitter handles
 */
export function loadWalletMapping(filename?: string, projectId?: string): Record<string, string> {
  // If no filename is provided, return an empty mapping
  if (!filename) {
    logger.log('No wallet mapping file specified, skipping wallet mapping');
    return {};
  }
  
  try {
    // Check for project-specific mapping first
    let filePath: string;
    
    // First, handle the case where filename includes a path
    if (filename.includes('/') || filename.includes('\\')) {
      // This is a path-like filename, so just use it directly
      filePath = path.join(process.cwd(), 'config', filename);
      logger.log(`Loading wallet mapping from path: ${filePath}`);
    } else if (projectId) {
      // Try project-specific mapping first
      filePath = path.join(process.cwd(), 'config', 'mappings', filename);
      
      // If project-specific mapping doesn't exist, fall back to global mapping
      if (!fs.existsSync(filePath)) {
        logger.log(`Project-specific wallet mapping not found: ${filePath}, trying global mapping`);
        filePath = path.join(process.cwd(), 'config', filename);
      }
    } else {
      // Use global mapping
      filePath = path.join(process.cwd(), 'config', filename);
    }
    
    if (!fs.existsSync(filePath)) {
      logger.warn(`Wallet mapping file not found: ${filePath}`);
      return {};
    }
    
    logger.log(`Loading wallet mapping from ${filePath}`);
    const mappingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Normalize addresses to lowercase for case-insensitive comparison
    const normalizedMapping: Record<string, string> = {};
    
    for (const [address, handle] of Object.entries(mappingData)) {
      normalizedMapping[address.toLowerCase()] = (handle as string).toLowerCase();
    }
    
    return normalizedMapping;
  } catch (error) {
    logger.error(`Error loading wallet mapping from ${filename}:`, error);
    throw error;
  }
}

/**
 * Get the inverse mapping (Twitter handle to wallet address)
 * @param walletMapping The wallet-to-twitter mapping
 * @returns A map of Twitter handles to sets of wallet addresses
 */
export function getHandleToWalletMapping(walletMapping: Record<string, string>): Map<string, Set<string>> {
  const handleToWallet: Map<string, Set<string>> = new Map<string, Set<string>>();
  
  for (const [address, handle] of Object.entries(walletMapping)) {
    logger.verboseLog(`Mapping ${address} to ${handle}`);
    const normalizedHandle = handle.toLowerCase();
    const normalizedAddress = address.toLowerCase();
    
    if (!handleToWallet.has(normalizedHandle)) {
      handleToWallet.set(normalizedHandle, new Set<string>());
    }
    
    handleToWallet.get(normalizedHandle)!.add(normalizedAddress);
  }
  
  return handleToWallet;
}

/**
 * Fetch a wallet address for a Twitter handle from the Arena API
 * @param handle Twitter handle to lookup
 * @returns The wallet address or null if not found
 */
export async function getArenaAddressForHandle(handle: string): Promise<ArenaWalletResponse> {
  
  try {
    const apiUrl = `https://api.starsarena.com/user/handle?handle=${handle}`;
    logger.verboseLog(`Fetching Arena address for handle: ${handle}`);
    
    const response = await axios.get(apiUrl);
    
    if (response.data && response.data.user && response.data.user.dynamicAddress) {
      const address = response.data.user.dynamicAddress;
      const picture_url = response.data.user.twitter_pfp_url;

      return { address: address.toLowerCase(), picture_url};
    }

    return { address: "", picture_url: ""};
  } catch (error) {
    logger.error(`Error fetching Arena address for handle ${handle}:`, error);
    throw error;
  }
}
