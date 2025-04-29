import { generateAndSaveMuLeaderboard } from './services/leaderboardClassService';

/**
 * Main function to run the leaderboard generation
 */
async function main() {
  console.log('Starting MU leaderboard generation...');
  
  try {
    // Generate and save the leaderboard
    const leaderboard = await generateAndSaveMuLeaderboard();
    
    // Print the top 5 holders
    console.log('\nLeaderboard generated successfully with', leaderboard.entries.length, 'entries.');
    console.log('Top 5 holders:');
    
    for (let i = 0; i < Math.min(5, leaderboard.entries.length); i++) {
      const entry = leaderboard.entries[i];
      console.log(`#${entry.rank}: @${entry.twitterHandle} - ${entry.totalPoints.toLocaleString()} points`);
    }
    
    console.log('\nLeaderboard generation completed!');
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
