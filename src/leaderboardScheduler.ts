// Entry point for the MuBadges Leaderboard Scheduler
import * as dotenv from 'dotenv';
import { startLeaderboardScheduler, LeaderboardType } from './services/leaderboardSchedulerService';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the leaderboard scheduler
 * Starts the scheduler to periodically generate the MU leaderboard
 */
function main(): void {
  try {
    // Start the leaderboard scheduler with MU leaderboard type
    startLeaderboardScheduler({
      leaderboardTypes: [LeaderboardType.MU],
      runImmediately: true
    });
    
    console.log('MuBadges Leaderboard Scheduler started successfully');
    console.log('Generating MU leaderboard');
  } catch (error) {
    console.error('Failed to start MuBadges Leaderboard Scheduler:', error);
    process.exit(1);
  }
}

// Run the main function only if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}

export { main };
