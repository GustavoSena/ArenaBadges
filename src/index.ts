/**
 * MuBadges Main Entry Point
 * 
 * This file serves as the main entry point for the MuBadges application.
 * It provides a clean way to start both the badge and leaderboard servers.
 */
import * as dotenv from 'dotenv';
import { startLeaderboardSchedulerServer } from './leaderboard/server/leaderboardSchedulerServer';
import { startBadgeSchedulerServer } from './badges/server/badgeSchedulerServer';

// Load environment variables
dotenv.config();

/**
 * Main function to start all servers
 */
async function startAllServers() {
  try {
    console.log('Starting MuBadges servers...');
    
    // Start both servers
    await Promise.all([
      startBadgeSchedulerServer(),
      startLeaderboardSchedulerServer()
    ]);
    
    console.log('All MuBadges servers started successfully');
    console.log(`Badge Scheduler Server running on port ${process.env.BADGE_SERVER_PORT || 3000}`);
    console.log(`Leaderboard Scheduler Server running on port ${process.env.LEADERBOARD_SERVER_PORT || 3001}`);
    console.log(`Access the leaderboard at: http://localhost:${process.env.LEADERBOARD_SERVER_PORT || 3001}`);
  } catch (error) {
    console.error('Failed to start MuBadges servers:', error);
    process.exit(1);
  }
}

// Run the servers if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  startAllServers();
}

export { startAllServers };
