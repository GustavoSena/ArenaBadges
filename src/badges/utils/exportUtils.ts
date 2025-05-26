import * as fs from 'fs';
import * as path from 'path';
import { ensureOutputDirectory } from '../../utils/helpers';
import logger from '../../utils/logger';

/**
 * Exports wallet addresses to JSON files
 * @param projectName The name of the project
 * @param basicAddresses Array of basic badge holder wallet addresses
 * @param upgradedAddresses Optional array of upgraded badge holder wallet addresses
 * @param timestamp Timestamp for the export
 */
export function exportWalletAddresses(
  projectName: string,
  basicAddresses: string[],
  upgradedAddresses?: string[],
  timestamp?: string
): void {
  logger.log('\nEXPORTING ADDRESSES: Saving wallet addresses to files');
  
  // Create output directory if it doesn't exist
  const outputDir = path.join(process.cwd(), 'output', 'addresses');
  ensureOutputDirectory(outputDir);
  
  // Generate timestamp for filenames if not provided
  const fileTimestamp = timestamp || new Date().toISOString().replace(/:/g, '-');
  
  // Save basic badge holder wallet addresses
  const basicAddressesFile = path.join(outputDir, `${projectName}_basic_wallet_addresses_${fileTimestamp}.json`);
  fs.writeFileSync(basicAddressesFile, JSON.stringify({
    addresses: basicAddresses,
    count: basicAddresses.length,
    timestamp: fileTimestamp,
    type: 'basic',
    project: projectName
  }, null, 2));
  logger.log(`Exported ${basicAddresses.length} basic badge holder wallet addresses to ${basicAddressesFile}`);
  
  // Only process upgraded addresses if they exist
  if (upgradedAddresses && upgradedAddresses.length > 0) {
    // Save upgraded badge holder wallet addresses
    const upgradedAddressesFile = path.join(outputDir, `${projectName}_upgraded_wallet_addresses_${fileTimestamp}.json`);
    fs.writeFileSync(upgradedAddressesFile, JSON.stringify({
      addresses: upgradedAddresses,
      count: upgradedAddresses.length,
      timestamp: fileTimestamp,
      type: 'upgraded',
      project: projectName
    }, null, 2));
    logger.log(`Exported ${upgradedAddresses.length} upgraded badge holder wallet addresses to ${upgradedAddressesFile}`);
    
    // Save all unique wallet addresses (combined)
    const allAddresses = [...new Set([...basicAddresses, ...upgradedAddresses])];
    const allAddressesFile = path.join(outputDir, `${projectName}_all_wallet_addresses_${fileTimestamp}.json`);
    fs.writeFileSync(allAddressesFile, JSON.stringify({
      addresses: allAddresses,
      count: allAddresses.length,
      timestamp: fileTimestamp,
      type: 'all',
      project: projectName
    }, null, 2));
    logger.log(`Exported ${allAddresses.length} total unique badge holder wallet addresses to ${allAddressesFile}`);
  } else {
    // If no upgraded addresses, just save basic addresses as "all"
    const allAddressesFile = path.join(outputDir, `${projectName}_all_wallet_addresses_${fileTimestamp}.json`);
    fs.writeFileSync(allAddressesFile, JSON.stringify({
      addresses: basicAddresses,
      count: basicAddresses.length,
      timestamp: fileTimestamp,
      type: 'all',
      project: projectName
    }, null, 2));
    logger.log(`Exported ${basicAddresses.length} total unique badge holder wallet addresses to ${allAddressesFile}`);
  }
}
