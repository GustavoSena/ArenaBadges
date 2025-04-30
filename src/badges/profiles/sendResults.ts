// Send Results Module
import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// API endpoint for sending results
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://api.example.com/results';
const API_KEY = process.env.API_KEY;

/**
 * Send results to the API endpoint
 * @param data The data to send
 * @returns Promise resolving to the API response
 */
export async function sendResults(data: any): Promise<any> {
  try {
    console.log('Sending results to API...');
    
    if (!API_KEY) {
      throw new Error('API_KEY environment variable is not set');
    }
    
    const response = await axios.post(API_ENDPOINT, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    console.log('Results sent successfully');
    return response.data;
  } catch (error) {
    console.error('Error sending results:', error);
    throw error;
  }
}

/**
 * Main function to send test results
 */
async function main() {
  try {
    const testData = {
      timestamp: new Date().toISOString(),
      message: 'Test message from MuBadges',
      data: {
        test: true,
        value: 'This is a test'
      }
    };
    
    console.log('Sending test data to API...');
    const result = await sendResults(testData);
    console.log('API response:', result);
  } catch (error) {
    console.error('Error in test:', error);
    process.exit(1);
  }
}

// Run a test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  if (API_KEY) {
    main();
  } else {
    console.log('This is a module for sending results to an API endpoint.');
    console.log('Set API_KEY environment variable to run a test.');
  }
}
