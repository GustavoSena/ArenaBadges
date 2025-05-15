/**
 * Simple test script to verify error propagation in the blockchain module
 */
import { fetchNftHolders } from '../src/api/blockchain';

async function testErrorPropagation() {
  console.log('Testing error propagation in blockchain module...');
  
  try {
    // Use an invalid contract address to force errors
    const invalidAddress = '0x1234567890123456789012345678901234567890';
    console.log(`Attempting to fetch NFT holders from invalid contract: ${invalidAddress}`);
    
    const holders = await fetchNftHolders(invalidAddress, 'Test NFT', 1, true);
    
    console.log('Result:', holders);
    console.log('Test failed: Expected an error to be thrown');
  } catch (error: unknown) {
    console.log('Error caught successfully:', error instanceof Error ? error.message : String(error));
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Retry failure') || 
        errorMessage.includes('Failed to get owner') || 
        errorMessage.includes('after 5 retries')) {
      console.log('✅ SUCCESS: Error was properly propagated with retry failure message');
    } else {
      console.log('❌ FAIL: Error does not contain expected retry failure message');
    }
  }
}

// Run the test
testErrorPropagation().catch(err => {
  console.error('Unexpected error in test:', err);
});
