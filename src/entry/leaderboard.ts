/**
 * Leaderboard Entry Point
 * 
 * This file serves as the main entry point for the leaderboard functionality.
 * It provides a clean separation between the leaderboard and badge components.
 */
import * as dotenv from 'dotenv';
import { startLeaderboardSchedulerServer } from '../leaderboardSchedulerServer';

// Load environment variables
dotenv.config();

// Start the leaderboard server if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Starting MuBadges Leaderboard Server...');
  startLeaderboardSchedulerServer();
}

export { startLeaderboardSchedulerServer };
