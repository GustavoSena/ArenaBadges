import { generateAndSaveLeaderboard } from './leaderboardClassService';
import { AppConfig } from '../../utils/config';
import * as fs from 'fs';
import * as path from 'path';
import { LeaderboardType } from './leaderboardFactory';
import logger from '../../utils/logger';

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
}

/**
 * Run all configured leaderboard generations
 * @param types Array of leaderboard types to generate
 * @returns ErrorType if there was an error, undefined if successful
 */
export async function runLeaderboardGeneration(appConfig: AppConfig): Promise<ErrorType | undefined> {

  logger.log(`Starting scheduled leaderboard generation at ${new Date().toISOString()}`);

  
  // Create a log entry for this run
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    logger.verboseLog(`Created log directory: ${logDir}`);
  }
  
  const logFile = path.join(logDir, `leaderboard_${new Date().toISOString().replace(/:/g, '-')}.log`);
  fs.writeFileSync(logFile, `Leaderboard generation started at ${new Date().toISOString()}\n`);
  
  logger.verboseLog(`Created log file: ${logFile}`);

    try {
      
      logger.verboseLog(`Starting generation for ${appConfig.projectName} leaderboard...`);
      
      await generateAndSaveLeaderboard(appConfig);

      fs.appendFileSync(logFile, `Successfully generated ${appConfig.projectName} leaderboard\n`);
      
      logger.verboseLog(`Completed generation for ${appConfig.projectName} leaderboard`);
      
    } catch (error) {
      logger.error(`Error generating ${appConfig.projectName} leaderboard:`, error);
      fs.appendFileSync(logFile, `Error generating ${appConfig.projectName} leaderboard: ${error}\n`);
      
      // For any error, prevent updating leaderboard and reschedule
      logger.error(`Error detected in leaderboard generation: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`Will reschedule for ${appConfig.projectConfig.scheduler.leaderboardRetryIntervalHours} hours later WITHOUT updating leaderboard files.`);
      
      // Log basic error info to the existing log file
      fs.appendFileSync(logFile, `Error: ${error}\n`);
      fs.appendFileSync(logFile, `Leaderboard files were not updated due to this error\n`);
      
      fs.appendFileSync(logFile, `NEXT RUN SCHEDULED FOR ${appConfig.projectConfig.scheduler.leaderboardRetryIntervalHours} HOURS LATER DUE TO RETRY FAILURES\n`);
      fs.appendFileSync(logFile, `NO LEADERBOARD FILES WERE UPDATED DUE TO RETRY FAILURES\n`);
      return ErrorType.RETRY_FAILURE;
  }
  
  fs.appendFileSync(logFile, `Leaderboard generation completed at ${new Date().toISOString()}\n`);
  
  logger.log(`Completed scheduled leaderboard generation successfully at ${new Date().toISOString()}`);
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
  
  // Get customizable retry interval from config (default to 2 hours if not specified)
  const retryIntervalHours = appConfig.projectConfig.scheduler.leaderboardRetryIntervalHours || 2;
  const retryIntervalMs = retryIntervalHours * 60 * 60 * 1000;
  
  logger.log(`Retry interval: ${retryIntervalHours} hours (when errors occur)`);
  
  logger.log(`Starting leaderboard scheduler to run every ${intervalHours} hours`);
  logger.log(`Retry interval: ${retryIntervalHours} hours (when retry failures occur)`);
  
  // Variable to store the next scheduled timeout
  let nextScheduledTimeout: NodeJS.Timeout | null = null;
  
  // Function to schedule the next run
  const scheduleNextRun = (delayMs: number) => {
    // Clear any existing timeout
    if (nextScheduledTimeout)
      clearTimeout(nextScheduledTimeout);
    
    // Calculate next run time
    const nextRunTime = new Date();
    nextRunTime.setTime(nextRunTime.getTime() + delayMs);
    
    // Call onSchedule callback if provided
    if (config.onSchedule)
      config.onSchedule(nextRunTime);
    
    // Schedule the next run
    nextScheduledTimeout = setTimeout(async () => {
      // Call onRun callback if provided
      if (config.onRun)
        config.onRun();
      
      
      // Run the scheduled task
      const errorType = await runLeaderboardGeneration(appConfig);
      
      // Determine the next interval based on the result
      let nextIntervalMs = intervalMs;
      
      if (errorType === ErrorType.RETRY_FAILURE) {
        logger.log(`Scheduling next leaderboard run in ${retryIntervalHours} hours due to retry failures`);
        nextIntervalMs = retryIntervalMs;
      } else
        logger.log(`Scheduling next leaderboard run in ${intervalHours} hours (normal interval)`);
      
      
      // Schedule the next run
      scheduleNextRun(nextIntervalMs);
    }, delayMs);
  };
  
  // Run immediately on startup if configured
  if (runImmediately) {
    (async () => {
      // Call onRun callback if provided
      if (config.onRun)
        config.onRun();
      
      // Run the scheduled task
      const errorType = await runLeaderboardGeneration(appConfig);
      
      // Determine the next interval based on the result
      let nextIntervalMs = intervalMs;
      
      if (errorType === ErrorType.RETRY_FAILURE) {
        logger.log(`Scheduling next leaderboard run in ${retryIntervalHours} hours due to retry failures`);
        nextIntervalMs = retryIntervalMs;
      } else
        logger.log(`Scheduling next leaderboard run in ${intervalHours} hours (normal interval)`);
      
      
      // Schedule the next run
      scheduleNextRun(nextIntervalMs);
    })();
  } else {
    // Schedule the first run without running immediately
    scheduleNextRun(intervalMs);
  }
}
