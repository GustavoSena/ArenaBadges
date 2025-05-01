// MU Leaderboard Generator
import * as dotenv from 'dotenv';
import { generateAndSaveMuLeaderboard } from '../services/leaderboardClassService';

// Load environment variables
dotenv.config();

/**
 * Main function to generate the MU leaderboard
 */
async function generateMuLeaderboard() {
  try {
    console.log('Generating MU leaderboard...');
    
    // Generate and save the MU leaderboard
    const leaderboard = await generateAndSaveMuLeaderboard(true);
    
    console.log(`Generated MU leaderboard with ${leaderboard.entries.length} entries`);
    console.log('MU leaderboard generation complete!');
  } catch (error) {
    console.error('Error generating MU leaderboard:', error);
    process.exit(1);
  }
}

// Run the generator if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  generateMuLeaderboard();
}

export { generateMuLeaderboard };
