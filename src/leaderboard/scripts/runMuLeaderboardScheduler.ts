/**
 * MU Leaderboard Scheduler Runner
 * 
 * This script starts the MU leaderboard scheduler to run at the configured interval.
 * It can be run directly to start the MU leaderboard scheduler as a standalone process.
 */
import { startLeaderboardScheduler, LeaderboardType } from '../services/leaderboardSchedulerService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if verbose mode is enabled via command line
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');

// Start the leaderboard scheduler
console.log('Starting MU Leaderboard Scheduler...');
startLeaderboardScheduler({
  leaderboardTypes: [LeaderboardType.MU],
  runImmediately: true,
  verbose,
  onSchedule: (nextRunTime) => {
    console.log(`Next leaderboard refresh scheduled for: ${nextRunTime.toISOString()}`);
  },
  onRun: () => {
    console.log(`Leaderboard refresh started at: ${new Date().toISOString()}`);
  }
});

console.log('MU Leaderboard Scheduler started successfully');
