/**
 * MuBadges Project Runner
 * 
 * This file serves as an entry point that accepts a project name parameter
 * and starts the appropriate schedulers based on available configurations.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Command } from 'commander';
import { startScheduler } from './badges/services/schedulerService';
import { startLeaderboardScheduler, LeaderboardType, getLeaderboardTypeFromString } from './leaderboard/services/leaderboardSchedulerService';
import { checkProjectExists, loadBadgeConfig, loadLeaderboardConfig } from './utils/config';

// Load environment variables
dotenv.config();

// Set up command line interface
const program = new Command();
program
  .name('runProject')
  .description('Run MuBadges project with specified name')
  .argument('<projectName>', 'Name of the project to run')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Run without sending data to API')
  .parse(process.argv);

// Get project name from command line arguments
const projectName = program.args[0];
const options = program.opts();
const verbose = options.verbose || false;
const dryRun = options.dryRun || false;

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
    schedulerConfig.intervals = config.intervals;
  }
  
  console.log('Loaded scheduler configuration from config/scheduler.json');
} catch (error) {
  console.warn('Could not load scheduler.json, using default interval values');
}

/**
 * Main function to start project schedulers
 */
async function startProject(projectName: string) {
  try {
    console.log(`Starting MuBadges project: ${projectName}`);
    
    // Check if project configurations exist
    const projectExists = checkProjectExists(projectName);
    
    if (!projectExists.badge && !projectExists.leaderboard) {
      console.error(`Error: No configurations found for project '${projectName}'`);
      console.error(`Please ensure either config/badges/${projectName}.json or config/leaderboards/${projectName}.json exists`);
      process.exit(1);
    }
    
    // Start badge scheduler if badge configuration exists
    if (projectExists.badge) {
      console.log(`Found badge configuration for ${projectName}`);
      const badgeConfig = loadBadgeConfig(projectName);
      
      startScheduler({
        intervalMs: schedulerConfig.intervals.badge * 60 * 60 * 1000,
        apiKey: process.env.API_KEY,
        verbose,
        dryRun,
        onSchedule: (nextRunTime) => {
          console.log(`Next badge refresh scheduled for: ${nextRunTime.toISOString()}`);
        },
        onRun: () => {
          console.log(`Badge refresh started at: ${new Date().toISOString()}`);
        }
      });
      
      console.log(`Badge scheduler started for project ${projectName}`);
    } else {
      console.log(`No badge configuration found for ${projectName}, badge scheduler not started`);
    }
    
    // Start leaderboard scheduler if leaderboard configuration exists
    if (projectExists.leaderboard) {
      console.log(`Found leaderboard configuration for ${projectName}`);
      
      // Add a delay before starting the leaderboard scheduler to prevent simultaneous API requests
      if (projectExists.badge) {
        console.log('Waiting 30 seconds before starting leaderboard scheduler to prevent API rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
      
      // Convert project name to LeaderboardType
      const leaderboardType = getLeaderboardTypeFromString(projectName);
      
      // Check if the project name is a valid LeaderboardType
      if (leaderboardType) {
        startLeaderboardScheduler({
          leaderboardTypes: [leaderboardType],
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
        
        console.log(`Leaderboard scheduler started for project ${projectName}`);
      } else {
        console.error(`Warning: Could not find a matching LeaderboardType for '${projectName}'`);
        console.error(`Make sure the leaderboard configuration file name matches a valid LeaderboardType`);
        console.error(`You may need to add '${projectName.toUpperCase()}' to the LeaderboardType enum in leaderboardSchedulerService.ts`);
        
        if (!projectExists.badge) {
          process.exit(1);
        }
      }
    } else {
      console.log(`No leaderboard configuration found for ${projectName}, leaderboard scheduler not started`);
    }
    
    if (projectExists.badge || projectExists.leaderboard) {
      console.log(`Project ${projectName} started successfully`);
      console.log(`Badge scheduler will run every ${schedulerConfig.intervals.badge} hours`);
      console.log(`Leaderboard scheduler will run every ${schedulerConfig.intervals.leaderboard} hours`);
    }
  } catch (error) {
    console.error(`Failed to start project ${projectName}:`, error);
    process.exit(1);
  }
}

// Run the project
startProject(projectName);
