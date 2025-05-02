/**
 * MuBadges Main Entry Point
 * 
 * This file serves as the main entry point for the MuBadges application.
 * It provides a clean way to start both the badge and leaderboard schedulers.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { startScheduler } from './badges/services/schedulerService';
import { startLeaderboardScheduler, LeaderboardType } from './leaderboard/services/leaderboardSchedulerService';

// Load environment variables
dotenv.config();

// Load scheduler configuration
const configPath = path.join(process.cwd(), 'config', 'scheduler.json');

// Try to load config or use defaults
let schedulerConfig = {
  intervals: {
    badge: 3, // hours
    leaderboard: 3 // hours
  }
};

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);
  
  // If config has interval settings, use them
  if (config.intervals) {
    schedulerConfig.intervals = config.intervals
  }
  
  console.log('Loaded scheduler configuration from config/scheduler.json');
} catch (error) {
  console.warn('Could not load scheduler.json, using default interval values');
}

// Check if verbose mode is enabled via command line
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

/**
 * Main function to start all schedulers
 */
async function startAllSchedulers() {
  try {
    console.log('Starting MuBadges schedulers...');
    
    // Start badge scheduler
    startScheduler({
      intervalMs: schedulerConfig.intervals.badge * 60 * 60 * 1000,
      apiKey: process.env.API_KEY,
      verbose,
      onSchedule: (nextRunTime) => {
        console.log(`Next badge refresh scheduled for: ${nextRunTime.toISOString()}`);
      },
      onRun: () => {
        console.log(`Badge refresh started at: ${new Date().toISOString()}`);
      }
    });
    
    // Add a delay before starting the leaderboard scheduler to prevent simultaneous API requests
    console.log('Waiting 10 seconds before starting leaderboard scheduler to prevent API rate limiting...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Start leaderboard scheduler
    startLeaderboardScheduler({
      leaderboardTypes: [LeaderboardType.MU],
      intervalMs: schedulerConfig.intervals.leaderboard * 60 * 60 * 1000,
      runImmediately: true,
      verbose,
      onSchedule: (nextRunTime) => {
        console.log(`Next leaderboard refresh scheduled for: ${nextRunTime.toISOString()}`);
      },
      onRun: () => {
        console.log(`Leaderboard refresh started at: ${new Date().toISOString()}`);
      }
    });
    
    console.log('All MuBadges schedulers started successfully');
    console.log(`Badge scheduler will run every ${schedulerConfig.intervals.badge} hours`);
    console.log(`Leaderboard scheduler will run every ${schedulerConfig.intervals.leaderboard} hours`);
  } catch (error) {
    console.error('Failed to start MuBadges schedulers:', error);
    process.exit(1);
  }
}

// Run the schedulers
startAllSchedulers();
