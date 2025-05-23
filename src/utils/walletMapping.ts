import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ArenaWalletResponse } from '../types/interfaces';


/**
 * Load wallet-to-twitter mapping from a JSON file
 * @param filename The name of the mapping file (relative to config directory)
 * @param projectId Optional project ID for project-specific mappings
 * @returns A record mapping wallet addresses to Twitter handles
 */
export function loadWalletMapping(filename?: string, projectId?: string): Record<string, string> {
  // If no filename is provided, return an empty mapping
  if (!filename) {
    console.log('No wallet mapping file specified, skipping wallet mapping');
    return {};
  }
  

  try {
    // Check for project-specific mapping first
    let filePath: string;
    
    // First, handle the case where filename includes a path
    if (filename.includes('/') || filename.includes('\\')) {
      // This is a path-like filename, so just use it directly
      filePath = path.join(process.cwd(), 'config', filename);
      console.log(`Loading wallet mapping from path: ${filePath}`);
    } else if (projectId) {
      // Try project-specific mapping first
      filePath = path.join(process.cwd(), 'config', 'mappings', filename);
      
      // If project-specific mapping doesn't exist, fall back to global mapping
      if (!fs.existsSync(filePath)) {
        console.log(`Project-specific wallet mapping not found: ${filePath}, trying global mapping`);
        filePath = path.join(process.cwd(), 'config', filename);
      }
    } else {
      // Use global mapping
      filePath = path.join(process.cwd(), 'config', filename);
    }
    
    if (!fs.existsSync(filePath)) {
      console.warn(`Wallet mapping file not found: ${filePath}`);
      return {};
    }
    
    console.log(`Loading wallet mapping from ${filePath}`);
    const mappingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Normalize addresses to lowercase for case-insensitive comparison
    const normalizedMapping: Record<string, string> = {};
    
    for (const [address, handle] of Object.entries(mappingData)) {
      normalizedMapping[address.toLowerCase()] = handle as string;
    }
    
    return normalizedMapping;
  } catch (error) {
    console.error(`Error loading wallet mapping from ${filename}:`, error);
    throw error;
  }
}

/**
 * Get the inverse mapping (Twitter handle to wallet address)
 * @param walletMapping The wallet-to-twitter mapping
 * @returns A record mapping Twitter handles to wallet addresses
 */
export function getHandleToWalletMapping(walletMapping: Record<string, string>, verbose: boolean = false): Map<string,Record<string, string>> {
  const handleToWallet: Map<string,Record<string, string>> = new Map<string,Record<string, string>>();
  
  for (const [address, handle] of Object.entries(walletMapping)) {
    if (verbose) console.log(`Mapping ${address} to ${handle}`);
    handleToWallet.set(handle.toLowerCase(), { [address.toLowerCase()]: 'mapping'});
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
    console.log(`Fetching Arena address for handle: ${handle}`);
    
    const response = await axios.get(apiUrl);
    
    if (response.data && response.data.user && response.data.user.dynamicAddress) {
      const address = response.data.user.dynamicAddress;
      const picture_url = response.data.user.twitter_pfp_url;

      return { address, picture_url};
    }
    

    return { address: "", picture_url: ""};
  } catch (error) {
    console.error(`Error fetching Arena address for handle ${handle}:`, error);
    throw error;
  }
}
