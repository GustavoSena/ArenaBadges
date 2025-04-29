// Entry point for the MuBadges Leaderboard Scheduler
import * as dotenv from 'dotenv';
import { startLeaderboardScheduler, LeaderboardType } from './services/leaderboardSchedulerService';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the leaderboard scheduler
 * Starts the scheduler to periodically generate different types of leaderboards
 */
function main(): void {
  try {
    // Parse command line arguments to determine which leaderboards to generate
    const args = process.argv.slice(2);
    const leaderboardTypes: LeaderboardType[] = [];
    
    // If specific leaderboard types are specified, use those
    if (args.length > 0) {
      for (const arg of args) {
        if (arg.toLowerCase() === 'standard') {
          leaderboardTypes.push(LeaderboardType.STANDARD);
        } else if (arg.toLowerCase() === 'mu') {
          leaderboardTypes.push(LeaderboardType.MU);
        } else {
          console.warn(`Unknown leaderboard type: ${arg}`);
        }
      }
    }
    
    // If no valid types specified, use all types
    if (leaderboardTypes.length === 0) {
      leaderboardTypes.push(LeaderboardType.STANDARD, LeaderboardType.MU);
    }
    
    // Start the leaderboard scheduler with the specified types
    startLeaderboardScheduler({
      leaderboardTypes,
      runImmediately: true
    });
    
    console.log('MuBadges Leaderboard Scheduler started successfully');
    console.log(`Generating leaderboards: ${leaderboardTypes.join(', ')}`);
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
