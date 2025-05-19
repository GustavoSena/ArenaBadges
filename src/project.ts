/**
 * Project-specific runner for ArenaBadges
 * 
 * This file provides a focused way to run project-specific components:
 * 1. Run badge scheduler for a specific project
 * 2. Run badge scheduler once for a specific project
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Command } from 'commander';
import { startScheduler, runAndSendResults } from './badges/services/schedulerService';
import { loadAppConfig } from './utils/config';

// Load environment variables
dotenv.config();

// Set up command line interface
const program = new Command();
program
  .name('project')
  .description('Run project-specific components for MuBadges')
  .version('1.0.0');

// Command to run badge scheduler
program
  .command('run <projectName>')
  .description('Run badge scheduler for a specific project')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Run without sending data to API')
  .action(async (projectName, options) => {
    await runProject(projectName, 'badge', false, options.verbose, options.dryRun);
  });

// Command to run badge scheduler only
program
  .command('badge <projectName>')
  .description('Run badge scheduler for a specific project')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Run without sending data to API')
  .option('--once', 'Run once and exit')
  .option('--export-addresses', 'Export addresses to file (only works with --dry-run)')
  .action(async (projectName, options) => {
    await runProject(projectName, 'badge', options.once, options.verbose, options.dryRun, options.exportAddresses);
  });

program.parse(process.argv);

/**
 * Check if project configuration exists
 * @param projectName The name of the project to check
 * @returns Boolean indicating if badge configuration exists
 */
function checkProjectConfig(projectName: string): boolean {
  const badgeConfigPath = path.join(process.cwd(), 'config', 'badges', `${projectName}.json`);
  return fs.existsSync(badgeConfigPath);
}

/**
 * Main function to run project badge component
 * @param projectName Name of the project
 * @param component Component to run ('badge')
 * @param runOnce Whether to run once and exit
 * @param verbose Whether to enable verbose logging
 * @param dryRun Whether to run without sending data to API
 */
async function runProject(
  projectName: string, 
  component: 'badge', 
  runOnce: boolean = false,
  verbose: boolean = false,
  dryRun: boolean = false,
  exportAddresses: boolean = false
) {
  try {
    if (!projectName) {
      console.error('Error: No project name provided');
      process.exit(1);
    }
    console.log(`Starting ArenaBadges project: ${projectName}, component: ${component}, runOnce: ${runOnce}`);
    
    // Check if project configuration exists
    const badgeConfigExists = checkProjectConfig(projectName);
    
    if (!badgeConfigExists) {
      console.error(`Error: No badge configuration found for project '${projectName}'`);
      process.exit(1);
    }
    
    // Load the app config for this project
    const appConfig = loadAppConfig(projectName);
    
    // Run badge component

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
        await runAndSendResults(appConfig, apiKey, { verbose, dryRun, runOnce, exportAddresses });
      } else {
        console.log(`Starting badge scheduler for project ${projectName}`);
        startScheduler(appConfig, {
          apiKey: apiKey,
          runOptions: { verbose, dryRun, runOnce, exportAddresses },
          onSchedule: (nextRunTime) => {
            console.log(`Next badge refresh scheduled for: ${nextRunTime.toISOString()}`);
          },
          onRun: () => {
            console.log(`Badge refresh started at: ${new Date().toISOString()}`);
          }
        });
      }
    
    if (runOnce) {
      console.log(`Completed one-time run for project ${projectName}`);
      process.exit(0);
    } else {
      console.log(`Project ${projectName} badge scheduler started successfully`);
      console.log(`Badge scheduler will run every ${appConfig.projectConfig.scheduler.badgeIntervalHours} hours`);
    }
  } catch (error) {
    console.error(`Failed to run project ${projectName}:`, error);
    process.exit(1);
  }
}