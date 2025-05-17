import { fetchTokenHolderProfiles } from '../profiles/fetchTokenHolderProfiles';
import { sendResults } from '../profiles/sendResults';
import { AppConfig } from '../../utils/config';


export interface RunOptions {
  verbose?: boolean;
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
 * @param verbose Whether to show verbose logging
 * @param dryRun If true, print JSON to console instead of sending to API
 * @param exportAddresses If true, export addresses to a CSV file
 * @returns ErrorType if there was an error, undefined if successful
 */
export async function runAndSendResults(appConfig: AppConfig, apiKey: string, runOptions: RunOptions): Promise<ErrorType | undefined> {

  
  // Get customizable retry interval from config (default to 2 hours if not specified)
  const retryIntervalHours = appConfig.projectConfig.scheduler.badgeRetryIntervalHours || 2;
  try {
    console.log(`Starting scheduled data collection at ${new Date().toISOString()}`);
    
    // Run the main process to fetch token holder profiles
    let results;
    try {
      // Pass the project name to fetchTokenHolderProfiles
      console.log(`Fetching token holder profiles for project: ${appConfig.projectName}`);
      results = await fetchTokenHolderProfiles(appConfig, runOptions.verbose || false);
    } catch (fetchError) {
      // Check if this is a retry failure
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      if (errorMessage.includes('max retries exceeded') || 
          errorMessage.includes('All retries failed') || 
          errorMessage.includes('retry limit exceeded') ||
          errorMessage.includes('Failed to get owner') ||
          errorMessage.includes('after 5 retries')) {
        console.error('Retry failure detected in token holder fetching. Will reschedule for 2 hours later WITHOUT sending data to API.');
        throw new Error(`Retry failure in fetchTokenHolderProfiles: ${errorMessage}`);
      }
      throw fetchError; // Re-throw other errors
    }
    
    // Validate results to ensure we have enough data before sending to API
    if (!results.basicHolders || results.basicHolders.length === 0) {
      console.error('No basic badge holders found. Will not send empty data to API.');
      throw new Error('No basic badge holders found');
    }
    
    if (runOptions.verbose) {
      console.log(`Fetched ${results.basicHolders.length} basic badge holders and ${results.upgradedHolders.length} upgraded badge holders`);
    }
    
    // Send the results to the API
    try {
      if (runOptions.dryRun) {
        console.log('Running in dry run mode - will print JSON instead of sending to API');
      }
      await sendResults(appConfig.badgeConfig, apiKey, {
        basicHolders: results.basicHolders,
        upgradedHolders: results.upgradedHolders,
        basicAddresses: results.basicAddresses,
        upgradedAddresses: results.upgradedAddresses,
        timestamp: new Date().toISOString()
      }, runOptions);
    } catch (sendError) {
      // Check if this is a retry failure in the API
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      if (errorMessage.includes('429') || 
          errorMessage.includes('rate limit') ||
          errorMessage.includes('too many requests')) {
        console.error('API rate limit detected in sending results. Will reschedule for 2 hours later WITHOUT sending data to API.');
        throw new Error(`API rate limit in sendResults: ${errorMessage}`);
      }
      throw sendError; // Re-throw other errors
    }
    
    console.log(`Completed scheduled run at ${new Date().toISOString()}`);
    return undefined; // Success
  } catch (error) {
    console.error('Error in scheduled run:', error);
    
    // For any error, prevent sending data and reschedule
    console.error(`Error detected in badge processing: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`Will reschedule for ${retryIntervalHours} hours later WITHOUT sending data to API.`);
    
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
  console.log(`Starting badge scheduler for project ${projectName}`);
  
  // Get configuration
  const intervalHours = appConfig.projectConfig.scheduler.badgeIntervalHours;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const apiKey = config.apiKey;
  const verbose = config.runOptions?.verbose || false;
  const runOnce = config.runOptions?.runOnce || false;
  
  // Get customizable retry interval from config (default to 2 hours if not specified)
  const retryIntervalHours = appConfig.projectConfig.scheduler.badgeRetryIntervalHours || 2;
  const retryIntervalMs = retryIntervalHours * 60 * 60 * 1000;
  
  console.log(`Retry interval: ${retryIntervalHours} hours (when errors occur)`);
  
  if (!apiKey) {
    throw new Error('API key is required. Set it in the config or as API_KEY environment variable.');
  }
  
  console.log(`Starting scheduler for project '${projectName}' to run every ${intervalHours} hours${verbose ? ' with verbose logging' : ''}`);
  
  // Get API endpoint from config
  const apiBaseUrl = appConfig.badgeConfig.api.baseUrl;
  console.log(`Using API base URL: ${apiBaseUrl}`);
  console.log(`Basic endpoint: ${appConfig.badgeConfig.api.endpoints.basic}`);
  console.log(`Upgraded endpoint: ${appConfig.badgeConfig.api.endpoints.upgraded}`);
  console.log(`Include combined in NFT-only: ${appConfig.badgeConfig.excludeBasicForUpgraded ? 'No' : 'Yes'}`);
  console.log(`Project name: ${projectName}`);
  
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
      
      // Run the scheduled task with project name
      console.log(`Running scheduled task for project: ${projectName}`);
      const errorType = await runAndSendResults(appConfig, apiKey, config.runOptions);
      
      // Determine the next interval based on the result
      let nextIntervalMs = intervalMs;
      
      if (errorType === ErrorType.RETRY_FAILURE) {
        console.log(`Scheduling next run in 2 hours due to retry failures`);
        nextIntervalMs = retryIntervalMs;
      } else {
        console.log(`Scheduling next run in ${intervalHours} hours (normal interval)`);
      }
      
      // Schedule the next run if not in runOnce mode
      if (runOnce) {
        console.log('Run once mode enabled - not scheduling next run');
      } else {
        scheduleNextRun(nextIntervalMs);
      }
    }, delayMs);
  };
  
  // Run immediately on startup
  (async () => {
    // Call onRun callback if provided
    if (config.onRun) {
      config.onRun();
    }
    
    // Run the scheduled task with project name
    console.log(`Running scheduled task for project: ${projectName}`);
    const errorType = await runAndSendResults(appConfig, apiKey, config.runOptions);
    
    // Determine the next interval based on the result
    let nextIntervalMs = intervalMs;
    
    if (errorType === ErrorType.RETRY_FAILURE) {
      console.log(`Scheduling next run in 2 hours due to retry failures`);
      nextIntervalMs = retryIntervalMs;
    } else {
      console.log(`Scheduling next run in ${intervalHours} hours (normal interval)`);
    }
    
    // Schedule the next run if not in runOnce mode
    if (runOnce) {
      console.log('Run once mode enabled - not scheduling next run');
    } else {
      scheduleNextRun(nextIntervalMs);
    }
  })();
}
