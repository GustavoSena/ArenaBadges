import * as dotenv from 'dotenv';
import { generateAndSaveMuLeaderboard, generateAndSaveStandardLeaderboard } from './leaderboardClassService';
import { AppConfig, loadAppConfig } from '../../utils/config';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Define leaderboard types
export enum LeaderboardType {
  STANDARD = 'standard',
  MU = 'mu'
}

/**
 * Get a LeaderboardType from a string
 * @param type The string representation of the leaderboard type
 * @returns The corresponding LeaderboardType or undefined if not found
 */
export function getLeaderboardTypeFromString(type: string): LeaderboardType | undefined {
  // First check if it's a direct match with the enum values
  const directMatch = Object.values(LeaderboardType).find(
    value => value.toLowerCase() === type.toLowerCase()
  );
  
  if (directMatch) {
    return directMatch as LeaderboardType;
  }
  
  // If not a direct match, try to match by enum key
  const keyMatch = Object.keys(LeaderboardType).find(
    key => key.toLowerCase() === type.toLowerCase()
  );
  
  if (keyMatch) {
    return LeaderboardType[keyMatch as keyof typeof LeaderboardType];
  }
  
  return undefined;
}

// Define error types
enum ErrorType {
  RETRY_FAILURE = 'RETRY_FAILURE',
  OTHER = 'OTHER'
}

// Interface for leaderboard scheduler configuration
export interface LeaderboardSchedulerConfig {
  runImmediately?: boolean;
  onSchedule?: (nextRunTime: Date) => void;
  onRun?: () => void;
  verbose?: boolean;
}

/**
 * Generate a specific type of leaderboard
 * @param type The type of leaderboard to generate
 * @param verbose Whether to log verbose output
 * @throws Error if there are retry failures or other critical errors
 */
async function generateLeaderboard(appConfig: AppConfig, verbose: boolean = false): Promise<void> {
  console.log(`Generating ${appConfig.projectName} leaderboard at ${new Date().toISOString()}`);
  
  try {
    if (verbose) {
      console.log(`Starting ${appConfig.projectName} leaderboard generation process...`);
    }
    
    switch (appConfig.projectName) {
      case LeaderboardType.STANDARD:
        await generateAndSaveStandardLeaderboard(appConfig, verbose);
        break;
      case LeaderboardType.MU:
        await generateAndSaveMuLeaderboard(appConfig, verbose);
        break;
      default:
        console.warn(`Unknown leaderboard type: ${appConfig.projectName}`);
        return;
    }
    
    console.log(`Successfully generated ${appConfig.projectName} leaderboard at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Error generating ${appConfig.projectName} leaderboard:`, error);
    
    // Check if this is a retry failure or Arena API error and propagate it
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('max retries exceeded') || 
        errorMessage.includes('All retries failed') || 
        errorMessage.includes('retry limit exceeded') ||
        errorMessage.includes('Failed to get owner') ||
        errorMessage.includes('after 5 retries') ||
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('Retry failure') ||
        errorMessage.includes('Arena API')) {
      throw new Error(`Retry failure in ${appConfig.projectName} leaderboard generation: ${errorMessage}`);
    }
    
    // Propagate other errors as well
    throw error;
  }
}

/**
 * Run all configured leaderboard generations
 * @param types Array of leaderboard types to generate
 * @param verbose Whether to log verbose output
 * @returns ErrorType if there was an error, undefined if successful
 */
export async function runLeaderboardGeneration(appConfig: AppConfig, verbose: boolean = false): Promise<ErrorType | undefined> {

  console.log(`Starting scheduled leaderboard generation at ${new Date().toISOString()}`);

  
  // Create a log entry for this run
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    if (verbose) {
      console.log(`Created log directory: ${logDir}`);
    }
  }
  
  const logFile = path.join(logDir, `leaderboard_${new Date().toISOString().replace(/:/g, '-')}.log`);
  fs.writeFileSync(logFile, `Leaderboard generation started at ${new Date().toISOString()}\n`);
  
  if (verbose) {
    console.log(`Created log file: ${logFile}`);
  }

    try {
      if (verbose) {
        console.log(`Starting generation for ${appConfig.projectName} leaderboard...`);
      }
      
      await generateLeaderboard(appConfig, verbose);
      fs.appendFileSync(logFile, `Successfully generated ${appConfig.projectName} leaderboard\n`);
      
      if (verbose) {
        console.log(`Completed generation for ${appConfig.projectName} leaderboard`);
      }
    } catch (error) {
      console.error(`Error generating ${appConfig.projectName} leaderboard:`, error);
      fs.appendFileSync(logFile, `Error generating ${appConfig.projectName} leaderboard: ${error}\n`);
      
      // For any error, prevent updating leaderboard and reschedule
      console.error(`Error detected in leaderboard generation: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`Will reschedule for ${appConfig.projectConfig.scheduler.leaderboardRetryIntervalHours} hours later WITHOUT updating leaderboard files.`);
      
      // Log basic error info to the existing log file
      fs.appendFileSync(logFile, `Error: ${error}\n`);
      fs.appendFileSync(logFile, `Leaderboard files were not updated due to this error\n`);
      
      fs.appendFileSync(logFile, `NEXT RUN SCHEDULED FOR ${appConfig.projectConfig.scheduler.leaderboardRetryIntervalHours} HOURS LATER DUE TO RETRY FAILURES\n`);
      fs.appendFileSync(logFile, `NO LEADERBOARD FILES WERE UPDATED DUE TO RETRY FAILURES\n`);
      return ErrorType.RETRY_FAILURE;
  }
  
  fs.appendFileSync(logFile, `Leaderboard generation completed at ${new Date().toISOString()}\n`);
  
  console.log(`Completed scheduled leaderboard generation successfully at ${new Date().toISOString()}`);
  return undefined; // Success
}

/**
 * Starts the leaderboard scheduler to run at specified intervals
 * @param config Configuration for the leaderboard scheduler
 */
export function startLeaderboardScheduler(appConfig: AppConfig, config: LeaderboardSchedulerConfig ): void {  

  
  const intervalHours = appConfig.projectConfig.scheduler.leaderboardIntervalHours || 3; // Default to 3 hours
  const intervalMs = (intervalHours * 60 * 60 * 1000);
  const runImmediately = config.runImmediately !== undefined ? config.runImmediately : false;
  const verbose = config.verbose || false;
  
  // Get customizable retry interval from config (default to 2 hours if not specified)
  const retryIntervalHours = appConfig.projectConfig.scheduler.leaderboardRetryIntervalHours || 2;
  const retryIntervalMs = retryIntervalHours * 60 * 60 * 1000;
  
  console.log(`Retry interval: ${retryIntervalHours} hours (when errors occur)`);
  
  console.log(`Starting leaderboard scheduler to run every ${intervalHours} hours${verbose ? ' with verbose logging' : ''}`);
  console.log(`Retry interval: ${retryIntervalHours} hours (when retry failures occur)`);
  
  // Variable to store the next scheduled timeout
  let nextScheduledTimeout: NodeJS.Timeout | null = null;
  
  // Function to schedule the next run
  const scheduleNextRun = (delayMs: number) => {
    // Clear any existing timeout
    if (nextScheduledTimeout) {
      clearTimeout(nextScheduledTimeout);
    }
    
    // Calculate next run time
    const nextRunTime = new Date();
    nextRunTime.setTime(nextRunTime.getTime() + delayMs);
    
    // Call onSchedule callback if provided
    if (config.onSchedule) {
      config.onSchedule(nextRunTime);
    }
    
    // Schedule the next run
    nextScheduledTimeout = setTimeout(async () => {
      // Call onRun callback if provided
      if (config.onRun) {
        config.onRun();
      }
      
      // Run the scheduled task
      const errorType = await runLeaderboardGeneration(appConfig, verbose);
      
      // Determine the next interval based on the result
      let nextIntervalMs = intervalMs;
      
      if (errorType === ErrorType.RETRY_FAILURE) {
        console.log(`Scheduling next leaderboard run in ${retryIntervalHours} hours due to retry failures`);
        nextIntervalMs = retryIntervalMs;
      } else {
        console.log(`Scheduling next leaderboard run in ${intervalHours} hours (normal interval)`);
      }
      
      // Schedule the next run
      scheduleNextRun(nextIntervalMs);
    }, delayMs);
  };
  
  // Run immediately on startup if configured
  if (runImmediately) {
    (async () => {
      // Call onRun callback if provided
      if (config.onRun) {
        config.onRun();
      }
      
      // Run the scheduled task
      const errorType = await runLeaderboardGeneration(appConfig, verbose);
      
      // Determine the next interval based on the result
      let nextIntervalMs = intervalMs;
      
      if (errorType === ErrorType.RETRY_FAILURE) {
        console.log(`Scheduling next leaderboard run in 2 hours due to retry failures`);
        nextIntervalMs = retryIntervalMs;
      } else {
        console.log(`Scheduling next leaderboard run in ${intervalHours} hours (normal interval)`);
      }
      
      // Schedule the next run
      scheduleNextRun(nextIntervalMs);
    })();
  } else {
    // Schedule the first run without running immediately
    scheduleNextRun(intervalMs);
  }
}
