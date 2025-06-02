import fs from 'fs';
import path from 'path';
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
 * Get a mapping of Twitter handles to wallet addresses
 * @param walletMapping A record mapping wallet addresses to Twitter handles, or a filename to load from
 * @returns A map of Twitter handles to wallet addresses
 */
export function getHandleToWalletMapping(walletMapping: Record<string, string> | string): Map<string, Set<string>> {
  const handleToWallet = new Map<string, Set<string>>();
  
  // If walletMapping is a string, treat it as a filename
  if (typeof walletMapping === 'string') {
    try {
      const configPath = path.resolve(process.cwd(), 'config', walletMapping);
      const rawData = fs.readFileSync(configPath, 'utf8');
      const data = JSON.parse(rawData);

      // Process each entry in the mapping file
      for (const [handle, addresses] of Object.entries(data)) {
        const normalizedHandle = handle.toLowerCase();
        const addressSet = new Set<string>();
        
        // Convert addresses object to a Set of normalized addresses
        for (const address of Object.values(addresses as Record<string, string>)) {
          const normalizedAddress = address.toLowerCase();
          addressSet.add(normalizedAddress);
        }
        
        handleToWallet.set(normalizedHandle, addressSet);
      }
    } catch (error) {
      logger.error(`Error loading wallet mapping from ${walletMapping}:`, error);
    }
  } else {
    // Process the wallet-to-handle mapping to create a handle-to-wallet mapping
    for (const [address, handle] of Object.entries(walletMapping)) {
      const normalizedHandle = handle.toLowerCase();
      const normalizedAddress = address.toLowerCase();
      
      if (!handleToWallet.has(normalizedHandle)) {
        handleToWallet.set(normalizedHandle, new Set<string>());
      }
      
      handleToWallet.get(normalizedHandle)!.add(normalizedAddress);
    }
  }
  
  return handleToWallet;
}

