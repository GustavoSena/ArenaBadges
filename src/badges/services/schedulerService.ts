import { fetchTokenHolderProfiles } from '../profiles/fetchTokenHolderProfiles';
import { sendResults } from '../profiles/sendResults';
import { loadTokensConfig } from '../utils/helpers';

interface SchedulerConfig {
  intervalMs?: number;
  apiKey?: string;
  onSchedule?: (nextRunTime: Date) => void;
  onRun?: () => void;
  verbose?: boolean;
  dryRun?: boolean;
  runOnce?: boolean;
}

// Define error types
enum ErrorType {
  RETRY_FAILURE = 'RETRY_FAILURE',
  OTHER = 'OTHER'
}

/**
 * Runs the data collection and sends results to the API
 * @param apiKey API key for authentication
 * @param verbose Whether to show verbose logs
 * @param dryRun If true, print JSON to console instead of sending to API
 * @returns ErrorType if there was an error, undefined if successful
 */
async function runAndSendResults(apiKey: string | undefined, verbose: boolean = false, dryRun: boolean = false): Promise<ErrorType | undefined> {
  try {
    console.log(`Starting scheduled data collection at ${new Date().toISOString()}`);
    
    // Run the main process to fetch token holder profiles
    let results;
    try {
      results = await fetchTokenHolderProfiles(verbose);
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
    if (!results.nftHolders || results.nftHolders.length === 0) {
      console.error('No NFT holders found. Will not send empty data to API.');
      throw new Error('No NFT holders found');
    }
    
    if (verbose) {
      console.log(`Fetched ${results.nftHolders.length} NFT holders and ${results.combinedHolders.length} combined holders`);
    }
    
    // Send the results to the API
    try {
      if (dryRun) {
        console.log('Running in dry run mode - will print JSON instead of sending to API');
      }
      await sendResults({
        nftHolders: results.nftHolders,
        combinedHolders: results.combinedHolders,
        timestamp: new Date().toISOString()
      }, { dryRun });
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
    
    // Check if this is a retry failure or Arena API error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('max retries exceeded') || 
        errorMessage.includes('All retries failed') || 
        errorMessage.includes('retry limit exceeded') ||
        errorMessage.includes('Failed to get owner') ||
        errorMessage.includes('after 5 retries') ||
        errorMessage.includes('Retry failure') ||
        errorMessage.includes('API rate limit') ||
        errorMessage.includes('No NFT holders found') ||
        errorMessage.includes('Arena API') ||
        errorMessage.includes('rate limit')) {
      console.error('Retry failure, Arena API error, or data validation error detected. Will reschedule for 2 hours later WITHOUT sending data to API.');
      return ErrorType.RETRY_FAILURE;
    }
    
    return ErrorType.OTHER;
  }
}

/**
 * Starts the scheduler to run at specified intervals
 */
export function startScheduler(config: SchedulerConfig = {}): void {
  // Load configuration
  const appConfig = loadTokensConfig();
  
  // Get configuration
  const intervalHours = appConfig.scheduler.intervalHours;
  const intervalMs = config.intervalMs || (intervalHours * 60 * 60 * 1000);
  const apiKey = config.apiKey || process.env.API_KEY;
  const verbose = config.verbose || false;
  const dryRun = config.dryRun || false;
  const runOnce = config.runOnce || false;
  
  // Define retry interval (2 hours)
  const retryIntervalMs = 2 * 60 * 60 * 1000;
  
  if (!apiKey) {
    throw new Error('API key is required. Set it in the config or as API_KEY environment variable.');
  }
  
  console.log(`Starting scheduler to run every ${intervalHours} hours${verbose ? ' with verbose logging' : ''}`);
  
  // Get API endpoint from config
  const apiBaseUrl = appConfig.api?.baseUrl || 'http://api.arena.social/badges';
  console.log(`Using API base URL: ${apiBaseUrl}`);
  console.log(`NFT-only endpoint: ${appConfig.api?.endpoints?.nftOnly || 'mu-tier-1'}`);
  console.log(`Combined endpoint: ${appConfig.api?.endpoints?.combined || 'mu-tier-2'}`);
  console.log(`Include combined in NFT-only: ${appConfig.api?.includeCombinedInNft !== false ? 'Yes' : 'No'}`);
  
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
      const errorType = await runAndSendResults(apiKey, verbose, dryRun);
      
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
    
    // Run the scheduled task
    const errorType = await runAndSendResults(apiKey, verbose, dryRun);
    
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

export { runAndSendResults };
