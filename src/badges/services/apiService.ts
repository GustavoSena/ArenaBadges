// API Service for Badge Server
import * as dotenv from 'dotenv';
import axios from 'axios';
import { HolderResults } from '../profiles/fetchTokenHolderProfiles';

// Load environment variables
dotenv.config();

// API endpoint for sending results
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://api.example.com/results';

/**
 * Send results to the API
 * @param apiKey API key for authentication
 * @param results Holder results to send
 * @returns Response from the API or null if no changes detected
 */
export async function sendResultsToApi(apiKey: string | undefined, results: HolderResults): Promise<any> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    console.log('Sending results to API...');
    
    // Prepare data for API
    const data = {
      nftHolders: results.nftHolders,
      combinedHolders: results.combinedHolders,
      timestamp: new Date().toISOString()
    };
    
    // Send data to API
    const response = await axios.post(API_ENDPOINT, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    console.log('Results sent successfully');
    return response.data;
  } catch (error: any) {
    // If the error is a 304 Not Modified, it means no changes were detected
    if (error.response && error.response.status === 304) {
      console.log('No changes detected. API update skipped.');
      return null;
    }
    
    console.error('Error sending results to API:', error.message);
    throw error;
  }
}
