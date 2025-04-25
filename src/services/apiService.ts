import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { loadConfig } from '../utils/helpers';

// File paths
const NFT_HOLDERS_PATH = path.join(__dirname, '../../files/nft_holders.json');
const COMBINED_HOLDERS_PATH = path.join(__dirname, '../../files/combined_holders.json');

interface ApiResponse {
  tier1Response: any;
  tier2Response: any;
}

/**
 * Sends the results to the specified API endpoints
 */
export async function sendResultsToApi(apiKey: string | undefined): Promise<ApiResponse> {
  try {
    if (!apiKey) {
      throw new Error('API key is required. Set it as API_KEY in your .env file.');
    }
    
    // Load configuration
    const config = loadConfig();
    const apiConfig = config.api;
    
    console.log(`Sending results to Arena Social Badges API...`);
    
    // Read the JSON files
    const nftHolders = JSON.parse(fs.readFileSync(NFT_HOLDERS_PATH, 'utf8'));
    const combinedHolders = JSON.parse(fs.readFileSync(COMBINED_HOLDERS_PATH, 'utf8'));
    
    // Set up headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Send NFT holders to tier 1 endpoint
    const nftEndpoint = `${apiConfig.baseUrl}/${apiConfig.endpoints.nftOnly}?key=${apiKey}`;
    const nftPayload = {
      handles: nftHolders.handles,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Sending ${nftHolders.handles.length} NFT-only holders to Tier 1 badge endpoint...`);
    const nftResponse = await axios.post(nftEndpoint, nftPayload, { headers });
    console.log(`Tier 1 badge API response status: ${nftResponse.status}`);
    
    // Send combined holders to tier 2 endpoint
    const combinedEndpoint = `${apiConfig.baseUrl}/${apiConfig.endpoints.combined}?key=${apiKey}`;
    const combinedPayload = {
      handles: combinedHolders.handles,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Sending ${combinedHolders.handles.length} combined holders to Tier 2 badge endpoint...`);
    const combinedResponse = await axios.post(combinedEndpoint, combinedPayload, { headers });
    console.log(`Tier 2 badge API response status: ${combinedResponse.status}`);
    
    console.log(`Successfully sent all data to Arena Social Badges API`);
    
    return {
      tier1Response: nftResponse.data,
      tier2Response: combinedResponse.data
    };
  } catch (error) {
    console.error('Error sending results to API:', error);
    throw error;
  }
}
