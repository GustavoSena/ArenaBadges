import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Cache for wallet mappings to avoid multiple disk reads
const walletMappingCache: { [key: string]: Record<string, string> } = {};

// Cache for Arena API responses to avoid multiple API calls
const arenaApiCache: { [handle: string]: string | null } = {};

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
  
  // Create a cache key that includes the project ID if provided
  const cacheKey = projectId ? `${projectId}:${filename}` : filename;
  
  // Check if we have this mapping in cache
  if (walletMappingCache[cacheKey]) {
    return walletMappingCache[cacheKey];
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
      filePath = path.join(process.cwd(), 'config', 'projects', projectId, filename);
      
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
      walletMappingCache[cacheKey] = {};
      return {};
    }
    
    console.log(`Loading wallet mapping from ${filePath}`);
    const mappingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Normalize addresses to lowercase for case-insensitive comparison
    const normalizedMapping: Record<string, string> = {};
    
    for (const [address, handle] of Object.entries(mappingData)) {
      normalizedMapping[address.toLowerCase()] = handle as string;
    }
    
    // Cache the result
    walletMappingCache[cacheKey] = normalizedMapping;
    return normalizedMapping;
  } catch (error) {
    console.error(`Error loading wallet mapping from ${filename}:`, error);
    walletMappingCache[cacheKey] = {};
    return {};
  }
}

/**
 * Get the inverse mapping (Twitter handle to wallet address)
 * @param walletMapping The wallet-to-twitter mapping
 * @returns A record mapping Twitter handles to wallet addresses
 */
export function getHandleToWalletMapping(walletMapping: Record<string, string>): Record<string, string> {
  const handleToWallet: Record<string, string> = {};
  
  for (const [address, handle] of Object.entries(walletMapping)) {
    handleToWallet[handle.toLowerCase()] = address;
  }
  
  return handleToWallet;
}

/**
 * Fetch a wallet address for a Twitter handle from the Arena API
 * @param handle Twitter handle to lookup
 * @returns The wallet address or null if not found
 */
export async function getArenaAddressForHandle(handle: string): Promise<string | null> {
  // Check if we have this handle in cache
  if (arenaApiCache[handle.toLowerCase()] !== undefined) {
    return arenaApiCache[handle.toLowerCase()];
  }
  
  try {
    const apiUrl = `https://api.starsarena.com/user/handle?handle=${handle}`;
    console.log(`Fetching Arena address for handle: ${handle}`);
    
    const response = await axios.get(apiUrl);
    
    if (response.data && response.data.user && response.data.user.dynamicAddress) {
      const address = response.data.user.dynamicAddress;
      // Cache the result
      arenaApiCache[handle.toLowerCase()] = address;
      return address;
    }
    
    // Cache null result
    arenaApiCache[handle.toLowerCase()] = null;
    return null;
  } catch (error) {
    console.error(`Error fetching Arena address for handle ${handle}:`, error);
    // Cache null result
    arenaApiCache[handle.toLowerCase()] = null;
    return null;
  }
}
