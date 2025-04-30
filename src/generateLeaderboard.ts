import * as dotenv from 'dotenv';
import * as path from 'path';
import { generateAndSaveLeaderboard } from './services/leaderboardService';

// Load environment variables
dotenv.config();

/**
 * Main function to generate the leaderboard
 */
async function main(): Promise<void> {
  try {
    console.log('Starting leaderboard generation...');
    
    // Generate and save the leaderboard
    const leaderboard = await generateAndSaveLeaderboard();
    
    console.log(`\nLeaderboard generated successfully with ${leaderboard.entries.length} entries.`);
    console.log(`Top 5 holders:`);
    
    // Display top 5 holders
    leaderboard.entries.slice(0, 5).forEach(entry => {
      console.log(`#${entry.rank}: @${entry.twitterHandle} - ${entry.totalPoints.toLocaleString()} points`);
    });
    
    console.log('\nLeaderboard generation completed!');
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
