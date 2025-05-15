/**
 * Test script for retry failure handling
 * 
 * This script tests the error propagation and handling in the blockchain module
 * by attempting to fetch NFT holders with an invalid contract address.
 */
import * as dotenv from 'dotenv';
import { fetchNftHolders } from '../src/api/blockchain';

// Load environment variables
dotenv.config();

// Run the test
async function runTest() {
  console.log('Starting retry handling test...');
  
  try {
    // Use an invalid contract address to force errors
    const invalidContractAddress = '0x0000000000000000000000000000000000000000';
    
    console.log('Testing fetchNftHolders with invalid contract address...');
    await fetchNftHolders(invalidContractAddress, 'Test NFT', 1, true);
    
    // If we get here, the function didn't throw an error as expected
    console.log('❌ FAIL: fetchNftHolders did not throw an error for invalid contract');
  } catch (error) {
    // Check if the error message contains the expected retry failure text
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('Error caught:', errorMessage);
    
    if (errorMessage.includes('Retry failure') || 
        errorMessage.includes('Failed to get owner') || 
        errorMessage.includes('after 5 retries') || 
        errorMessage.includes('rate limit')) {
      console.log('✅ SUCCESS: Error was properly propagated with retry failure message');
    } else {
      console.log('❌ FAIL: Error does not contain retry failure message');
    }
  }
  
  console.log('\nTest completed');
}

// Run the test
runTest().catch(console.error);
