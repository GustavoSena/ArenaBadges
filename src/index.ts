// Entry point for the MuBadges application
import * as dotenv from 'dotenv';
import { fetchAndSaveHolderProfiles } from './holderProfileManager';
import { startScheduler } from './services/schedulerService';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the application
 * Starts the scheduler to periodically fetch and send holder profiles
 */
function main(): void {
  try {
    // Start the scheduler with default configuration
    startScheduler();
    console.log('MuBadges application started successfully');
  } catch (error) {
    console.error('Failed to start MuBadges application:', error);
    process.exit(1);
  }
}

// Run the main function only if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
