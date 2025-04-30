// Start both badge scheduler and leaderboard scheduler servers
import * as dotenv from 'dotenv';
import { startBadgeSchedulerServer } from './badgeSchedulerServer';
import { startLeaderboardSchedulerServer } from './leaderboardSchedulerServer';

// Load environment variables
dotenv.config();

/**
 * Main function to start both servers
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
    console.log(`Access the MU leaderboard at: http://localhost:${process.env.LEADERBOARD_SERVER_PORT || 3001}/mu`);
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
