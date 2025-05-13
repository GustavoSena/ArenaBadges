/**
 * Badge Scheduler Runner
 * 
 * This script starts the badge scheduler to run at the configured interval.
 * It can be run directly to start the badge scheduler as a standalone process.
 */
import { startScheduler } from '../services/schedulerService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get API key from environment variables
const apiKey = process.env.API_KEY;

// Check if verbose mode is enabled via command line
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');

// Check if dry run mode is enabled via command line
const dryRun = args.includes('--dry-run') || args.includes('-d');

// Check if this is a one-time run
const runOnce = args.includes('--run-once') || args.includes('-o');

// Start the scheduler
startScheduler({
  apiKey,
  verbose,
  dryRun,
  runOnce,
  onSchedule: (nextRunTime) => {
    console.log(`Next scheduled run: ${nextRunTime.toISOString()}`);
  },
  onRun: () => {
    console.log('Running scheduled task...');
  }
});
