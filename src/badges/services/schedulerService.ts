import { fetchBadgeHolders } from '../profiles/fetchBadgeHolder';
import { sendResults } from '../profiles/sendResults';
import { AppConfig } from '../../utils/config';
import logger from '../../utils/logger';


export interface RunOptions {
  dryRun?: boolean;
  runOnce?: boolean;
  exportAddresses?: boolean;
}

interface SchedulerConfig {
  apiKey?: string;
  onSchedule?: (nextRunTime: Date) => void;
  onRun?: () => void;
  runOptions: RunOptions;
}

// Define error types
export enum ErrorType {
  RETRY_FAILURE = 'RETRY_FAILURE',
  OTHER = 'OTHER'
}

/**
 * Runs the data collection and sends results to the API
 * @param apiKey API key for authentication
 * @param dryRun If true, print JSON to console instead of sending to API
 * @param exportAddresses If true, export addresses to a CSV file
 * @returns ErrorType if there was an error, undefined if successful
 */
export async function runAndSendResults(appConfig: AppConfig, runOptions: RunOptions, apiKey?: string): Promise<ErrorType | undefined> {

  
  // Get customizable retry interval from config (default to 2 hours if not specified)
  const retryIntervalHours = appConfig.projectConfig.scheduler.badgeRetryIntervalHours || 2;
  try {
    logger.log(`Starting scheduled data collection at ${new Date().toISOString()}`);
    
    // Run the main process to fetch token holder profiles
    let results;
    try {
      // Pass the project name to fetchTokenHolderProfiles
      results = await fetchBadgeHolders(appConfig);
    } catch (fetchError) {
      // Check if this is a retry failure
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      if (errorMessage.includes('max retries exceeded') || 
          errorMessage.includes('All retries failed') || 
          errorMessage.includes('retry limit exceeded') ||
          errorMessage.includes('Failed to get owner') ||
          errorMessage.includes('after 5 retries')) {
        logger.error('Retry failure detected in token holder fetching. Will reschedule for 2 hours later WITHOUT sending data to API.');
        throw new Error(`Retry failure in fetchTokenHolderProfiles: ${errorMessage}`);
      }
      throw fetchError; // Re-throw other errors
    }
    
    // Validate results to ensure we have enough data before sending to API
    if (!results.basicHolders || results.basicHolders.length === 0) {
      logger.error('No basic badge holders found. Will not send empty data to API.');
      throw new Error('No basic badge holders found');
    }
    
    logger.verboseLog(`Fetched ${results.basicHolders.length} basic badge holders${results.upgradedHolders ? ` and ${results.upgradedHolders.length} upgraded badge holders` : ''}`);
    
    // Send the results to the API
    try {
      if (runOptions.dryRun) {
        logger.log('Running in dry run mode - will print JSON instead of sending to API');
      }
      await sendResults(appConfig.badgeConfig, {
        basicHolders: results.basicHolders,
        basicAddresses: results.basicAddresses,
        timestamp: results.timestamp || new Date().toISOString(),
        upgradedHolders: results.upgradedHolders,
        upgradedAddresses: results.upgradedAddresses
      }, runOptions, apiKey);
    } catch (sendError) {
      // Check if this is a retry failure in the API
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      logger.error(`Error detected in badge processing: ${errorMessage}`);
      throw sendError; // Re-throw other errors
    }
    
    logger.log(`Completed scheduled run at ${new Date().toISOString()}`);
    return undefined; // Success
  } catch (error) {
    logger.error('Error in scheduled run:', error);
    
    // For any error, prevent sending data and reschedule
    logger.error(`Error detected in badge processing: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`Will reschedule for ${retryIntervalHours} hours later WITHOUT sending data to API.`);
    
    // Always return RETRY_FAILURE for any error to prevent sending incorrect data
    return ErrorType.RETRY_FAILURE;
  }
}

/**
 * Starts the scheduler to run at specified intervals
 */
export function startScheduler(appConfig: AppConfig, config: SchedulerConfig): void {
  // Load configuration
  const projectName = appConfig.projectName;
  logger.log(`Starting badge scheduler for project ${projectName}`);
  
  // Get configuration
  const intervalHours = appConfig.projectConfig.scheduler.badgeIntervalHours;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const apiKey = config.apiKey;
  const runOnce = config.runOptions?.runOnce || false;
  
  // Get customizable retry interval from config (default to 2 hours if not specified)
  const retryIntervalHours = appConfig.projectConfig.scheduler.badgeRetryIntervalHours || 2;
  const retryIntervalMs = retryIntervalHours * 60 * 60 * 1000;
  
  logger.log(`Retry interval: ${retryIntervalHours} hours (when errors occur)`);
  
  if (!apiKey && !config.runOptions?.dryRun) 
    throw new Error('API key is required. Set it in the BADGE_KEYS environment variable.');
  
  logger.log(`Starting scheduler for project '${projectName}' to run every ${intervalHours} hours`);
  
  // Get API endpoint from config
  const apiBaseUrl = appConfig.badgeConfig.api.baseUrl;
  logger.verboseLog(`Using API base URL: ${apiBaseUrl}`);
  logger.verboseLog(`Basic endpoint: ${appConfig.badgeConfig.api.endpoints.basic}`);
  logger.verboseLog(`Upgraded endpoint: ${appConfig.badgeConfig.api.endpoints.upgraded}`);
  logger.verboseLog(`Include combined in NFT-only: ${appConfig.badgeConfig.excludeBasicForUpgraded ? 'No' : 'Yes'}`);
  logger.verboseLog(`Project name: ${projectName}`);
  
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
      
      // Run the scheduled task with project name
      logger.log(`Running scheduled task for project: ${projectName}`);
      const errorType = await runAndSendResults(appConfig, config.runOptions, apiKey);
      
      // Determine the next interval based on the result
      let nextIntervalMs = intervalMs;
      
      if (errorType === ErrorType.RETRY_FAILURE) {
        logger.log(`Scheduling next run in 2 hours due to retry failures`);
        nextIntervalMs = retryIntervalMs;
      } else 
        logger.log(`Scheduling next run in ${intervalHours} hours (normal interval)`);
      
      // Schedule the next run if not in runOnce mode
      if (!runOnce) 
        scheduleNextRun(nextIntervalMs);
      else 
        logger.log('Run once mode enabled - not scheduling next run');
    }, delayMs);
  };
  
  // Run immediately on startup
  (async () => {
    // Call onRun callback if provided
    if (config.onRun) 
      config.onRun();
    
    // Run the scheduled task with project name
    logger.log(`Running scheduled task for project: ${projectName}`);
    const errorType = await runAndSendResults(appConfig, config.runOptions, apiKey);
    
    // Determine the next interval based on the result
    let nextIntervalMs = intervalMs;
    
    if (errorType === ErrorType.RETRY_FAILURE) {
      logger.log(`Scheduling next run in 2 hours due to retry failures`);
      nextIntervalMs = retryIntervalMs;
    } else 
      logger.log(`Scheduling next run in ${intervalHours} hours (normal interval)`);
    
    // Schedule the next run if not in runOnce mode
    if (!runOnce) 
      scheduleNextRun(nextIntervalMs);
    else 
      logger.log('Run once mode enabled - not scheduling next run');
    
  })();
}
