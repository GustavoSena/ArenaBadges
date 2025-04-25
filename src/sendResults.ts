import * as dotenv from 'dotenv';
import { fetchTokenHolderProfiles } from './services/holderService';
import { sendResultsToApi } from './services/apiService';
import { fetchAndSaveHolderProfiles } from './holderProfileManager';

// Load environment variables
dotenv.config();

/**
 * Sends the current results to the API
 */
async function sendResults(): Promise<void> {
  try {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      throw new Error('API key is required. Set it as API_KEY in your .env file.');
    }
    
    console.log('Fetching current holder profiles...');
    
    // Fetch the latest holder profiles and save them to files
    const results = await fetchAndSaveHolderProfiles();
    
    console.log('Sending current results to Arena Social Badges API...');
    const response = await sendResultsToApi(apiKey, results);
    
    if (response === null) {
      console.log('No changes detected. API update skipped.');
    } else {
      console.log('Results sent successfully!');
    }
  } catch (error) {
    console.error('Failed to send results:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  sendResults();
}
