// Test script for Arena API
import axios from 'axios';

// Constants
const ARENA_API_URL = 'https://api.arena.trade/user_info';

// Test addresses - known to have Twitter handles
const TEST_ADDRESSES = [
  '0xeaef03364970a3cfd79a5a6ec75028d1fc2dea70', // Example from your request
  '0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0', // Mu Pups contract address
  '0xdba664085ae73cf4e4eb57954bdc88be297b1f09'  // MUV token address
];

async function testArenaApi() {
  console.log('Testing Arena API with new endpoint format...\n');
  
  for (const address of TEST_ADDRESSES) {
    try {
      console.log(`Fetching data for address: ${address}`);
      const response = await axios.get(`${ARENA_API_URL}?user_address=eq.${address.toLowerCase()}`);
      
      console.log(`Response status: ${response.status}`);
      console.log(`Data received: ${JSON.stringify(response.data, null, 2)}\n`);
      
      if (response.data && response.data.length > 0) {
        console.log(`Twitter handle: ${response.data[0].twitter_handle || 'None'}`);
      } else {
        console.log('No profile found for this address');
      }
      console.log('-'.repeat(50));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Error fetching data for ${address}: ${error.message}`);
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      } else {
        console.error(`Unexpected error for ${address}: ${error}`);
      }
      console.log('-'.repeat(50));
    }
  }
}

// Run the test
testArenaApi().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
