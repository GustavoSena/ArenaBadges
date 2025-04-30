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
    console.log('Sending refresh command to leaderboard server...');
    
    // Send POST request to the trigger endpoint
    const response = await axios.post(`http://localhost:${PORT}/trigger`);
    
    if (response.status === 202) {
      console.log('Leaderboard refresh triggered successfully!');
      console.log(response.data.message);
    } else {
      console.error('Unexpected response:', response.status, response.data);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`Error: Could not connect to the leaderboard server at http://localhost:${PORT}`);
        console.error('Make sure the leaderboard server is running.');
      } else {
        console.error('Error triggering leaderboard refresh:', error.message);
        if (error.response) {
          console.error('Server response:', error.response.data);
        }
      }
    } else {
      console.error('Error triggering leaderboard refresh:', error);
    }
    process.exit(1);
  }
}

// Run the refresh function if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  refreshLeaderboard();
}

export { refreshLeaderboard };
