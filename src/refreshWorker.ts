// Refresh Worker Process
import * as dotenv from 'dotenv';
import axios from 'axios';
import { LeaderboardType, runLeaderboardGeneration } from './services/leaderboardSchedulerService';

// Load environment variables
dotenv.config();

// Default port for the leaderboard scheduler server
const PORT = process.env.LEADERBOARD_SERVER_PORT || 3001;

/**
 * Main function to run the refresh worker
 */
async function runRefreshWorker() {
  try {
    console.log('Starting leaderboard refresh worker process');
    
    // Determine which leaderboard type to generate
    const leaderboardTypes: LeaderboardType[] = [];
    
    // Always generate MU leaderboard by default
    leaderboardTypes.push(LeaderboardType.MU);
    
    // Check if we should also generate the standard leaderboard
    if (process.env.GENERATE_STANDARD_LEADERBOARD === 'true') {
      console.log('Standard leaderboard generation requested');
      leaderboardTypes.push(LeaderboardType.STANDARD);
    }
    
    // Run the leaderboard generation
    await runLeaderboardGeneration(leaderboardTypes);
    
    // Notify the server that the refresh is complete
    await notifyRefreshComplete();
    
    console.log('Leaderboard refresh worker process completed');
    process.exit(0);
  } catch (error) {
    console.error('Error in leaderboard refresh worker:', error);
    
    // Try to notify the server that the refresh failed
    try {
      await notifyRefreshComplete();
    } catch (notifyError) {
      console.error('Failed to notify server of refresh completion:', notifyError);
    }
    
    process.exit(1);
  }
}

/**
 * Notify the server that the refresh is complete
 */
async function notifyRefreshComplete(): Promise<void> {
  try {
    const secret = process.env.REFRESH_SECRET || 'local-refresh-secret';
    const response = await axios.post(`http://localhost:${PORT}/reset-refreshing`, { secret });
    console.log('Notified server of refresh completion:', response.status);
  } catch (error) {
    console.error('Failed to notify server of refresh completion:', error);
    throw error;
  }
}

// Run the worker if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runRefreshWorker();
}

export { runRefreshWorker };
