// API Service for Badge Server
import * as dotenv from 'dotenv';
import axios from 'axios';
import { HolderResults } from '../profiles/fetchTokenHolderProfiles';

// Load environment variables
dotenv.config();

/**
 * Send results to the API
 * @param apiKey API key for authentication
 * @param results Holder results to send
 * @param apiEndpoint The API endpoint to send results to (without the API key)
 * @param verbose Whether to log verbose output
 * @returns Response from the API or null if no changes detected
 */
export async function sendResultsToApi(
  apiKey: string | undefined, 
  results: HolderResults,
  apiEndpoint: string,
  verbose: boolean = false
): Promise<any> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!apiEndpoint) {
      throw new Error('API endpoint is required');
    }

    // Append the API key as a query parameter
    const endpointWithKey = `${apiEndpoint}?key=${apiKey}`;
    
    if (verbose) {
      console.log(`Preparing to send results to API: ${apiEndpoint}`);
      console.log(`Data contains ${results.nftHolders?.length || 0} NFT holders and ${results.combinedHolders?.length || 0} combined holders`);
    } else {
      console.log(`Sending results to API: ${apiEndpoint}`);
    }
    
    // Prepare data for API - use 'handles' as the key
    const data = {
      handles: results.nftHolders || results.combinedHolders,
      timestamp: new Date().toISOString()
    };
    
    if (verbose) {
      console.log('Sending API request...');
    }
    
    // Send data to API using query parameter for API key
    const response = await axios.post(endpointWithKey, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (verbose) {
      console.log(`API response status: ${response.status}`);
      console.log(`API response data: ${JSON.stringify(response.data).substring(0, 100)}...`);
    } else {
      console.log('Results sent successfully');
    }
    
    return response.data;
  } catch (error) {
    // If the error is an Axios error with a 304 status, it means no changes were detected
    if (axios.isAxiosError(error) && error.response && error.response.status === 304) {
      console.log('No changes detected. API update skipped.');
      return null;
    }
    
    // Handle other errors
    const errorMessage = axios.isAxiosError(error) 
      ? `Error sending results to API: ${error.message}` 
      : `Error sending results to API: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    console.error(errorMessage);
    throw error;
  }
}