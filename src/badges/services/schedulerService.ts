import { fetchTokenHolderProfiles } from '../profiles/fetchTokenHolderProfiles';
import { sendResults } from '../profiles/sendResults';
import { loadTokensConfig } from '../utils/helpers';

interface SchedulerConfig {
  intervalMs?: number;
  apiKey?: string;
  onSchedule?: (nextRunTime: Date) => void;
  onRun?: () => void;
  verbose?: boolean;
}

/**
 * Runs the data collection and sends results to the API
 */
async function runAndSendResults(apiKey: string | undefined, verbose: boolean = false): Promise<void> {
  try {
    console.log(`Starting scheduled data collection at ${new Date().toISOString()}`);
    
    // Run the main process to fetch token holder profiles
    const results = await fetchTokenHolderProfiles(verbose);
    
    if (verbose) {
      console.log(`Fetched ${results.nftHolders.length} NFT holders and ${results.combinedHolders.length} combined holders`);
    }
    
    // Send the results to the API
    await sendResults({
      nftHolders: results.nftHolders,
      combinedHolders: results.combinedHolders,
      timestamp: new Date().toISOString()
    });
    
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
  const appConfig = loadTokensConfig();
  
  // Get configuration
  const intervalHours = appConfig.scheduler.intervalHours;
  const intervalMs = config.intervalMs || (intervalHours * 60 * 60 * 1000);
  const apiKey = config.apiKey || process.env.API_KEY;
  const verbose = config.verbose || false;
  
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
  
  // Run immediately on startup
  runAndSendResults(apiKey, verbose);
  
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
    runAndSendResults(apiKey, verbose);
    
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
