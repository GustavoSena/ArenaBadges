/**
 * Leaderboard Refresh Entry Point
 * 
 * This file serves as the entry point for manually refreshing the leaderboard.
 * It provides a clean separation between the leaderboard and badge components.
 */
import * as dotenv from 'dotenv';
import { refreshLeaderboard } from '../refreshLeaderboard';

// Load environment variables
dotenv.config();

// Refresh the leaderboard if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Triggering manual leaderboard refresh...');
  refreshLeaderboard();
}

export { refreshLeaderboard };
