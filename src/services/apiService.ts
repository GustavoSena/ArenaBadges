import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { loadAppConfig } from '../utils/config';
import { HolderResults } from './holderService';

// File paths
const NFT_HOLDERS_PATH = path.join(__dirname, '../../files/nft_holders.json');
const COMBINED_HOLDERS_PATH = path.join(__dirname, '../../files/combined_holders.json');

interface ApiResponse {
  tier1Response: any;
  tier2Response: any;
}

/**
 * Compare current results with previously saved files
 * Returns true if there are changes, false if they are the same
 */
function hasChanges(results: HolderResults): { nftChanged: boolean, combinedChanged: boolean } {
  try {
    // Check if files exist
    const nftFileExists = fs.existsSync(NFT_HOLDERS_PATH);
    const combinedFileExists = fs.existsSync(COMBINED_HOLDERS_PATH);
    
    // If files don't exist, consider it as changed
    if (!nftFileExists || !combinedFileExists) {
      console.log('Previous result files not found, considering as changed');
      return { nftChanged: true, combinedChanged: true };
    }
    
    // Read previous results
    const previousNftHolders = JSON.parse(fs.readFileSync(NFT_HOLDERS_PATH, 'utf8'));
    const previousCombinedHolders = JSON.parse(fs.readFileSync(COMBINED_HOLDERS_PATH, 'utf8'));
    
    // Compare lengths first (quick check)
    const nftLengthChanged = previousNftHolders.handles.length !== results.nftHolders.length;
    const combinedLengthChanged = previousCombinedHolders.handles.length !== results.combinedHolders.length;
    
    if (nftLengthChanged || combinedLengthChanged) {
      console.log('Number of holders has changed');
      return { 
        nftChanged: nftLengthChanged, 
        combinedChanged: combinedLengthChanged 
      };
    }
    
    // Sort arrays for comparison (order shouldn't matter)
    const sortedPreviousNft = [...previousNftHolders.handles].sort();
    const sortedCurrentNft = [...results.nftHolders].sort();
    
    const sortedPreviousCombined = [...previousCombinedHolders.handles].sort();
    const sortedCurrentCombined = [...results.combinedHolders].sort();
    
    // Deep comparison
    const nftChanged = JSON.stringify(sortedPreviousNft) !== JSON.stringify(sortedCurrentNft);
    const combinedChanged = JSON.stringify(sortedPreviousCombined) !== JSON.stringify(sortedCurrentCombined);
    
    if (nftChanged || combinedChanged) {
      console.log('Holder content has changed');
    } else {
      console.log('No changes detected in holder lists');
    }
    
    return { nftChanged, combinedChanged };
  } catch (error) {
    console.error('Error comparing results:', error);
    // If there's an error in comparison, assume there are changes to be safe
    return { nftChanged: true, combinedChanged: true };
  }
}

/**
 * Sends the results to the specified API endpoints if there are changes
 */
export async function sendResultsToApi(apiKey: string | undefined, results: HolderResults): Promise<ApiResponse | null> {
  try {
    if (!apiKey) {
      throw new Error('API key is required. Set it as API_KEY in your .env file.');
    }
    
    // Load configuration
    const config = loadAppConfig();
    const apiConfig = config.api;
    
    console.log(`Checking for changes in holder lists...`);
    
    // Check if there are changes compared to previously saved files
    const { nftChanged, combinedChanged } = hasChanges(results);
    
    // If nothing changed, don't send to API
    if (!nftChanged && !combinedChanged) {
      console.log('No changes detected in either holder list. Skipping API update.');
      return null;
    }
    
    console.log(`Sending results to Arena Social Badges API...`);
    
    // Set up headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    let nftResponse = null;
    let combinedResponse = null;
    
    // Send NFT holders to tier 1 endpoint if changed
    if (nftChanged) {
      const nftEndpoint = `${apiConfig.baseUrl}/${apiConfig.endpoints.nftOnly}?key=${apiKey}`;
      const nftPayload = {
        handles: results.nftHolders,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Sending ${results.nftHolders.length} NFT-only holders to Tier 1 badge endpoint...`);
      nftResponse = await axios.post(nftEndpoint, nftPayload, { headers });
      console.log(`Tier 1 badge API response status: ${nftResponse.status}`);
    } else {
      console.log('NFT holder list unchanged. Skipping Tier 1 update.');
    }
    
    // Send combined holders to tier 2 endpoint if changed
    if (combinedChanged) {
      const combinedEndpoint = `${apiConfig.baseUrl}/${apiConfig.endpoints.combined}?key=${apiKey}`;
      const combinedPayload = {
        handles: results.combinedHolders,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Sending ${results.combinedHolders.length} combined holders to Tier 2 badge endpoint...`);
      combinedResponse = await axios.post(combinedEndpoint, combinedPayload, { headers });
      console.log(`Tier 2 badge API response status: ${combinedResponse.status}`);
    } else {
      console.log('Combined holder list unchanged. Skipping Tier 2 update.');
    }
    
    console.log(`API update completed`);
    
    return {
      tier1Response: nftResponse?.data || null,
      tier2Response: combinedResponse?.data || null
    };
  } catch (error) {
    console.error('Error sending results to API:', error);
    throw error;
  }
}
