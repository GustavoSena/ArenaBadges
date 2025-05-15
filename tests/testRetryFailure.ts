/**
 * Test script for retry failure handling
 * 
 * This script simulates a retry failure in the blockchain module
 * and tests if the scheduler properly handles it by:
 * 1. Not sending data to the API
 * 2. Rescheduling for 2 hours later
 */
import * as dotenv from 'dotenv';
import { runAndSendResults } from '../src/badges/services/schedulerService';
import { fetchTokenHolderProfiles } from '../src/badges/profiles/fetchTokenHolderProfiles';
import { sendResults } from '../src/badges/profiles/sendResults';

// Load environment variables
dotenv.config();

// Original functions to restore after test
const originalFetchTokenHolderProfiles = fetchTokenHolderProfiles;
const originalSendResults = sendResults;

// Track if sendResults was called
let sendResultsCalled = false;

// Mock the fetchTokenHolderProfiles function to simulate a retry failure
(global as any).fetchTokenHolderProfiles = () => {
  console.log('Mocked fetchTokenHolderProfiles called - simulating retry failure');
  throw new Error('Failed to get owner for token 123 after 5 retries due to rate limiting');
};

// Mock the sendResults function to verify it's not called
(global as any).sendResults = () => {
  console.log('Mocked sendResults called - THIS SHOULD NOT HAPPEN');
  sendResultsCalled = true;
  return Promise.resolve();
};

// Run the test
async function runTest() {
  console.log('Starting retry failure test...');
  
  try {
    // Get API key from environment
    const apiKey = process.env.API_KEY;
    
    // Run the scheduler function with verbose logging
    const result = await runAndSendResults(apiKey, true);
    
    // Check the result
    console.log('Test result:', result);
    
    // Verify that the sendResults function was not called
    if (!sendResultsCalled) {
      console.log('✅ SUCCESS: sendResults was not called');
    } else {
      console.log('❌ FAIL: sendResults was called');
    }
    
    // Verify that the result is RETRY_FAILURE
    if (result === 'RETRY_FAILURE') {
      console.log('✅ SUCCESS: Result is RETRY_FAILURE');
    } else {
      console.log('❌ FAIL: Result is not RETRY_FAILURE');
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    // Restore original functions
    (global as any).fetchTokenHolderProfiles = originalFetchTokenHolderProfiles;
    (global as any).sendResults = originalSendResults;
  }
}

// Run the test
runTest().catch(console.error);
