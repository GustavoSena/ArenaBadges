// Holder Profile Manager
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fetchTokenHolderProfiles, HolderResults } from './fetchTokenHolderProfiles';

// Load environment variables
dotenv.config();

// File paths
const OUTPUT_DIR = path.join(process.cwd(), 'output');

/**
 * Ensure the output directory exists
 */
function ensureOutputDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Save data to a JSON file
 */
function saveToJsonFile(data: any, filePath: string): void {
  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonData);
}

/**
 * Fetch holder profiles and save results to files
 */
export async function fetchAndSaveHolderProfiles(): Promise<HolderResults> {
  try {
    console.log('Fetching holder profiles...');
    
    // Ensure output directory exists
    ensureOutputDirectory(OUTPUT_DIR);
    
    // Fetch holder profiles
    const results = await fetchTokenHolderProfiles();
    
    // Save results to files
    if (results.nftHolders && results.nftHolders.length > 0) {
      const nftOutputData = { handles: results.nftHolders };
      saveToJsonFile(nftOutputData, path.join(OUTPUT_DIR, 'nft_holders.json'));
      console.log(`Saved ${results.nftHolders.length} NFT-only holder Twitter handles to ${path.join(OUTPUT_DIR, 'nft_holders.json')}`);
    } else {
      console.log('No NFT holders to save.');
    }
    
    if (results.combinedHolders && results.combinedHolders.length > 0) {
      const combinedOutputData = { handles: results.combinedHolders };
      saveToJsonFile(combinedOutputData, path.join(OUTPUT_DIR, 'combined_holders.json'));
      console.log(`Saved ${results.combinedHolders.length} combined holder Twitter handles to ${path.join(OUTPUT_DIR, 'combined_holders.json')}`);
    } else {
      console.log('No combined holders to save.');
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching and saving holder profiles:', error);
    throw error;
  }
}

/**
 * Main function to fetch and save holder profiles
 */
async function main() {
  try {
    console.log('Starting holder profile fetching...');
    
    // Fetch and save holder profiles
    await fetchAndSaveHolderProfiles();
    
    console.log('Holder profile fetching completed!');
  } catch (error) {
    console.error('Error fetching holder profiles:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
