// Holder Profile Manager - Fetches and saves token/NFT holder profiles
import * as fs from 'fs';
import * as path from 'path';
import { fetchTokenHolderProfiles, HolderResults } from './services/holderService';
import { saveToJsonFile, ensureOutputDirectory } from './utils/helpers';

// File paths
const NFT_HOLDERS_PATH = path.join(__dirname, '../files/nft_holders.json');
const COMBINED_HOLDERS_PATH = path.join(__dirname, '../files/combined_holders.json');

/**
 * Fetch holder profiles and save results to files
 */
export async function fetchAndSaveHolderProfiles(): Promise<HolderResults> {
  try {
    // Ensure output directory exists
    const outputDir = path.join(__dirname, '../files');
    ensureOutputDirectory(outputDir);
    
    // Fetch holder profiles
    const results = await fetchTokenHolderProfiles();
    
    // Save results to files
    const nftOutputData = { handles: results.nftHolders };
    saveToJsonFile(NFT_HOLDERS_PATH, nftOutputData);
    console.log(`Saved ${results.nftHolders.length} NFT-only holder Twitter handles to ${NFT_HOLDERS_PATH}`);
    
    const combinedOutputData = { handles: results.combinedHolders };
    saveToJsonFile(COMBINED_HOLDERS_PATH, combinedOutputData);
    console.log(`Saved ${results.combinedHolders.length} combined holder Twitter handles to ${COMBINED_HOLDERS_PATH}`);
    
    return results;
  } catch (error) {
    console.error('Error in fetchAndSaveHolderProfiles:', error);
    throw error;
  }
}

// Run the main function only if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  fetchAndSaveHolderProfiles().catch(console.error);
}
