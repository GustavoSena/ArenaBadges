// Script to force refresh the leaderboard on the running server
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default port for the leaderboard scheduler server
const PORT = process.env.LEADERBOARD_SERVER_PORT || 3001;

/**
 * Main function to trigger a leaderboard refresh
 */
async function refreshLeaderboard(): Promise<void> {
  try {
    console.log('Sending refresh request to leaderboard server...');
    
    // Get the port from environment or use default
    const port = process.env.LEADERBOARD_SERVER_PORT || 3001;
    
    // Send a POST request to the trigger endpoint
    const response = await axios.post(`http://localhost:${port}/trigger`);
    
    console.log(`Server response: ${response.status} ${response.statusText}`);
    console.log('Refresh request sent successfully');
    
    if (response.data) {
      console.log('Response data:', response.data);
    }
  } catch (error: any) {
    console.error('Error sending refresh request:', error.message);
    
    if (error.response) {
      console.error('Server response:', error.response.status, error.response.data);
    }
    
    process.exit(1);
  }
}

// Run the refresh function if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  refreshLeaderboard();
}

export { refreshLeaderboard };
