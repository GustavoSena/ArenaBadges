/**
 * Project-specific runner for MuBadges
 * 
 * This file provides a focused way to run project-specific components:
 * 1. Run both badge and leaderboard schedulers for a specific project
 * 2. Run a single scheduler (badge or leaderboard) for a specific project
 * 3. Run a single component once for a specific project
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Command } from 'commander';
import { startScheduler, runAndSendResults } from './badges/services/schedulerService';
import { startLeaderboardScheduler, runLeaderboardGeneration, LeaderboardType, getLeaderboardTypeFromString } from './leaderboard/services/leaderboardSchedulerService';

// Load environment variables
dotenv.config();

// Set up command line interface
const program = new Command();
program
  .name('project')
  .description('Run project-specific components for MuBadges')
  .version('1.0.0');

// Command to run both schedulers
program
  .command('run <projectName>')
  .description('Run both badge and leaderboard schedulers for a specific project')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Run without sending data to API')
  .action(async (projectName, options) => {
    await runProject(projectName, 'all', false, options.verbose, options.dryRun);
  });

// Command to run badge scheduler only
program
  .command('badge <projectName>')
  .description('Run badge scheduler for a specific project')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Run without sending data to API')
  .option('--once', 'Run once and exit')
  .action(async (projectName, options) => {
    await runProject(projectName, 'badge', options.once, options.verbose, options.dryRun);
  });

// Command to run leaderboard scheduler only
program
  .command('leaderboard <projectName>')
  .description('Run leaderboard scheduler for a specific project')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--once', 'Run once and exit')
  .action(async (projectName, options) => {
    await runProject(projectName, 'leaderboard', options.once, options.verbose, options.dryRun);
  });

program.parse(process.argv);

/**
 * Check if project configurations exist
 * @param projectName The name of the project to check
 * @returns An object with flags indicating which configurations exist
 */
function checkProjectConfigs(projectName: string): { badge: boolean, leaderboard: boolean } {
  const badgeConfigPath = path.join(process.cwd(), 'config', 'badges', `${projectName}.json`);
  const leaderboardConfigPath = path.join(process.cwd(), 'config', 'leaderboards', `${projectName}.json`);
  
  const badgeExists = fs.existsSync(badgeConfigPath);
  const leaderboardExists = fs.existsSync(leaderboardConfigPath);
  
  return {
    badge: badgeExists,
    leaderboard: leaderboardExists
  };
}

/**
 * Main function to run project components
 * @param projectName Name of the project
 * @param component Component to run ('all', 'badge', or 'leaderboard')
 * @param runOnce Whether to run once and exit
 * @param verbose Whether to enable verbose logging
 * @param dryRun Whether to run without sending data to API
 */
async function runProject(
  projectName: string, 
  component: 'all' | 'badge' | 'leaderboard', 
  runOnce: boolean = false,
  verbose: boolean = false,
  dryRun: boolean = false
) {
  try {
    console.log(`Starting ArenaBadges project: ${projectName}, component: ${component}, runOnce: ${runOnce}`);
    
    // Check if project configurations exist
    const configs = checkProjectConfigs(projectName);
    
    if (!configs.badge && !configs.leaderboard) {
      console.error(`Error: No configurations found for project '${projectName}'`);
      console.error(`Please ensure either config/badges/${projectName}.json or config/leaderboards/${projectName}.json exists`);
      process.exit(1);
    }
    
    // Load scheduler configuration
    const schedulerConfig = loadSchedulerConfig();
    
    // Run badge component if requested and available
    if ((component === 'all' || component === 'badge') && configs.badge) {
      // Parse the BADGE_KEYS environment variable to get the project-specific API key
      let badgeKeys: { [key: string]: string } = {};
      try {
        badgeKeys = JSON.parse(process.env.BADGE_KEYS || '{}');
      } catch (error) {
        console.error('Error parsing BADGE_KEYS environment variable:', error);
        process.exit(1);
      }
      
      // Get the project-specific API key
      const apiKey = badgeKeys[projectName];
      if (!apiKey) {
        console.error(`Error: No API key found for project '${projectName}' in BADGE_KEYS environment variable`);
        process.exit(1);
      }
      
      if (runOnce) {
        console.log(`Running badge component once for project ${projectName}`);
        await runAndSendResults(apiKey, verbose, dryRun, projectName);
      } else {
        console.log(`Starting badge scheduler for project ${projectName}`);
        startScheduler({
          projectName: projectName,
          intervalMs: schedulerConfig.badge * 60 * 60 * 1000,
          apiKey: apiKey,
          verbose,
          dryRun,
          runOnce,
          onSchedule: (nextRunTime) => {
            console.log(`Next badge refresh scheduled for: ${nextRunTime.toISOString()}`);
          },
          onRun: () => {
            console.log(`Badge refresh started at: ${new Date().toISOString()}`);
          }
        });
      }
    } else if (component === 'badge' && !configs.badge) {
      console.error(`Error: Badge configuration not found for project '${projectName}'`);
      process.exit(1);
    }
    
    // Run leaderboard component if requested and available
    if ((component === 'all' || component === 'leaderboard') && configs.leaderboard) {
      // Add a delay before starting the leaderboard scheduler to prevent simultaneous API requests
      if (component === 'all' && configs.badge && !runOnce) {
        console.log('Waiting 30 seconds before starting leaderboard scheduler to prevent API rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
      
      const leaderboardType = getLeaderboardTypeFromString(projectName);
      
      if (!leaderboardType) {
        console.error(`Error: Could not find a matching LeaderboardType for '${projectName}'`);
        if (component === 'leaderboard') {
          process.exit(1);
        }
      } else {
        if (runOnce) {
          console.log(`Running leaderboard generation once for project ${projectName}`);
          await runLeaderboardGeneration([leaderboardType], verbose);
        } else {
          console.log(`Starting leaderboard scheduler for project ${projectName}`);
          startLeaderboardScheduler({
            leaderboardTypes: [leaderboardType],
            intervalMs: schedulerConfig.leaderboard * 60 * 60 * 1000,
            runImmediately: true,
            verbose,
            onSchedule: (nextRunTime) => {
              console.log(`Next leaderboard refresh scheduled for: ${nextRunTime.toISOString()}`);
            },
            onRun: () => {
              console.log(`Leaderboard refresh started at: ${new Date().toISOString()}`);
            }
          });
        }
      }
    } else if (component === 'leaderboard' && !configs.leaderboard) {
      console.error(`Error: Leaderboard configuration not found for project '${projectName}'`);
      process.exit(1);
    }
    
    if (runOnce) {
      console.log(`Completed one-time run for project ${projectName}, component: ${component}`);
      process.exit(0);
    } else {
      console.log(`Project ${projectName} schedulers started successfully`);
      if ((component === 'all' || component === 'badge') && configs.badge) {
        console.log(`Badge scheduler will run every ${schedulerConfig.badge} hours`);
      }
      if ((component === 'all' || component === 'leaderboard') && configs.leaderboard) {
        console.log(`Leaderboard scheduler will run every ${schedulerConfig.leaderboard} hours`);
      }
    }
  } catch (error) {
    console.error(`Failed to run project ${projectName}:`, error);
    process.exit(1);
  }
}

/**
 * Load scheduler configuration
 * @returns Object with scheduler intervals in hours
 */
function loadSchedulerConfig(): { badge: number, leaderboard: number } {
  const configPath = path.join(process.cwd(), 'config', 'scheduler.json');
  const defaultConfig = {
    badge: 3,
    leaderboard: 3
  };
  
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      return {
        badge: config.intervals?.badge || defaultConfig.badge,
        leaderboard: config.intervals?.leaderboard || defaultConfig.leaderboard
      };
    }
  } catch (error) {
    console.warn('Could not load scheduler.json, using default interval values');
  }
  
  return defaultConfig;
}
