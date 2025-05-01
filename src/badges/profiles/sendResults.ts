// Send Results Module
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Load configuration
const configPath = path.join(process.cwd(), 'config', 'tokens.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Get API endpoints from config
const API_BASE_URL = config.api?.baseUrl || 'http://api.arena.social/badges';
const NFT_ONLY_ENDPOINT = config.api?.endpoints?.nftOnly || 'mu-tier-1';
const COMBINED_ENDPOINT = config.api?.endpoints?.combined || 'mu-tier-2';

// Check if combined holders should also be in the NFT-only list
const INCLUDE_COMBINED_IN_NFT = config.api?.includeCombinedInNft !== false; // Default to true if not specified

// API key from environment variables
const API_KEY = process.env.API_KEY;

/**
 * Send results to the API endpoints
 * @param data The data to send
 * @returns Promise resolving to the API response
 */
export async function sendResults(data: any): Promise<any> {
  try {
    console.log('Sending results to API...');
    
    if (!API_KEY) {
      throw new Error('API_KEY environment variable is not set');
    }
    
    // Prepare NFT-only data
    let nftOnlyHandles;
    if (INCLUDE_COMBINED_IN_NFT) {
      // Include combined holders in NFT-only list
      nftOnlyHandles = [...new Set([...data.nftHolders])];
      console.log(`Including combined holders in NFT-only list (${nftOnlyHandles.length} total handles)`);
    } else {
      // Filter out combined holders from NFT-only list
      const combinedSet = new Set(data.combinedHolders);
      nftOnlyHandles = data.nftHolders.filter((handle: string) => !combinedSet.has(handle));
      console.log(`Excluding combined holders from NFT-only list (${nftOnlyHandles.length} NFT-only handles)`);
    }
    
    const nftOnlyData = {
      handles: nftOnlyHandles,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    const combinedData = {
      handles: data.combinedHolders,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    // Construct endpoints with key as query parameter
    const nftEndpoint = `${API_BASE_URL}/${NFT_ONLY_ENDPOINT}?key=${API_KEY}`;
    const combinedEndpoint = `${API_BASE_URL}/${COMBINED_ENDPOINT}?key=${API_KEY}`;
    
    // Send data to both endpoints
    console.log(`Sending NFT-only holders to ${API_BASE_URL}/${NFT_ONLY_ENDPOINT}`);
    console.log(`NFT-only holders: ${nftOnlyData.handles.length}`);
    const nftResponse = await axios.post(nftEndpoint, nftOnlyData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Sending combined holders to ${API_BASE_URL}/${COMBINED_ENDPOINT}`);
    console.log(`Combined holders: ${combinedData.handles.length}`);
    const combinedResponse = await axios.post(combinedEndpoint, combinedData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Results sent successfully to both endpoints');
    return {
      nftOnly: nftResponse.data,
      combined: combinedResponse.data
    };
  } catch (error: any) {
    console.error('Error sending results:', error.message || String(error));
    throw error;
  }
}

// Run a test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  if (API_KEY) {
    const testData = {
      nftHolders: ['mucoinofficial', 'ceojonvaughn', 'aunkitanandi'],
      combinedHolders: ['mucoinofficial', 'ceojonvaughn', 'aunkitanandi'],
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending test data to API...');
    sendResults(testData)
      .then(result => console.log('API response:', result))
      .catch(error => console.error('Error in test:', error));
  } else {
    console.log('This is a module for sending results to an API endpoint.');
    console.log('Set API_KEY environment variable to run a test.');
  }
}
