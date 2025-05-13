import { fetchTokenHolderProfiles } from './holderService';
import { sendResultsToApi } from './apiService';
import { loadAppConfig } from '../utils/config';

interface SchedulerConfig {
  intervalMs?: number;
  apiKey?: string;
  onSchedule?: (nextRunTime: Date) => void;
  onRun?: () => void;
}

/**
 * Runs the data collection and sends results to the API
 */
async function runAndSendResults(apiKey: string | undefined): Promise<void> {
  try {
    console.log(`Starting scheduled data collection at ${new Date().toISOString()}`);
    
    // Run the main process to fetch token holder profiles
    const results = await fetchTokenHolderProfiles();
    
    // Send the results to the API
    await sendResultsToApi(apiKey, results);
    
    console.log(`Completed scheduled run at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error in scheduled run:', error);
  }
}

/**
 * Starts the scheduler to run at specified intervals
 */
export function startScheduler(config: SchedulerConfig = {}): void {
  // Load configuration
  const appConfig = loadAppConfig();
  
  // Get configuration
  const intervalHours = appConfig.scheduler.badgeIntervalHours;
  const intervalMs = config.intervalMs || (intervalHours * 60 * 60 * 1000);
  const apiKey = config.apiKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error('API key is required. Set it in the config or as API_KEY environment variable.');
  }
  
  console.log(`Starting scheduler to run every ${intervalHours} hours`);
  
  // Run immediately on startup
  runAndSendResults(apiKey);
  
  // Call onRun callback if provided
  if (config.onRun) {
    config.onRun();
  }
  
  // Calculate next run time
  const nextRunTime = new Date();
  nextRunTime.setTime(nextRunTime.getTime() + intervalMs);
  
  // Call onSchedule callback if provided
  if (config.onSchedule) {
    config.onSchedule(nextRunTime);
  }
  
  // Then schedule to run at the specified interval
  setInterval(() => {
    // Run the scheduled task
    runAndSendResults(apiKey);
    
    // Call onRun callback if provided
    if (config.onRun) {
      config.onRun();
    }
    
    // Calculate next run time
    const nextRunTime = new Date();
    nextRunTime.setTime(nextRunTime.getTime() + intervalMs);
    
    // Call onSchedule callback if provided
    if (config.onSchedule) {
      config.onSchedule(nextRunTime);
    }
  }, intervalMs);
}

export { runAndSendResults };
