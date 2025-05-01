// Leaderboard Generator
import * as dotenv from 'dotenv';
import { generateAndSaveLeaderboard } from '../services/leaderboardService';

// Load environment variables
dotenv.config();

/**
 * Main function to generate a leaderboard
 */
async function generateLeaderboard() {
  try {
    console.log('Generating leaderboard...');
    
    // Generate and save the leaderboard
    const leaderboard = await generateAndSaveLeaderboard();
    
    console.log(`Generated leaderboard with ${leaderboard.entries.length} entries`);
    console.log('Leaderboard generation complete!');
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    process.exit(1);
  }
}

// Run the generator if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  generateLeaderboard();
}

export { generateLeaderboard };
