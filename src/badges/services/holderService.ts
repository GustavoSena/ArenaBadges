// Holder Service for Badge Server
import * as dotenv from 'dotenv';
import { fetchTokenHolderProfiles as fetchProfiles, HolderResults } from '../profiles/fetchTokenHolderProfiles';

// Load environment variables
dotenv.config();

/**
 * Fetch token holder profiles
 * This is a wrapper around the fetchTokenHolderProfiles function from the profiles module
 */
export async function fetchTokenHolderProfiles(): Promise<HolderResults> {
  try {
    console.log('Fetching token holder profiles...');
    const results = await fetchProfiles();
    console.log(`Fetched profiles for ${results.nftHolders.length} NFT holders and ${results.combinedHolders.length} combined holders`);
    return results;
  } catch (error) {
    console.error('Error fetching token holder profiles:', error);
    return {
      nftHolders: [],
      combinedHolders: []
    };
  }
}
