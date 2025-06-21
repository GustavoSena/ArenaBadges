// Send Results Module
import axios from 'axios';
import { setTimeout } from 'timers/promises';
import { BadgeConfig } from '../../types/badge';
import { RunOptions } from '../services/schedulerService';
import { exportWalletAddresses } from '../utils/exportUtils';
import logger from '../../utils/logger';

// Constants
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const RETRY_DELAY_MS = 2000; // 2 seconds

/**
 * Send results to the API endpoints
 * @param badgeConfig The badge configuration
 * @param apiKey The API key to use for authentication
 * @param data The data to send
 * @param options Options for sending results
 * @param options.dryRun If true, print JSON to console instead of sending to API
 * @returns Promise resolving to the API response
 */
/**
 * Makes a POST request with retry logic and timeout handling
 * @param url The URL to send the request to
 * @param data The data to send in the request body
 * @param requestType Description of the request type for logging
 * @returns The response from the server
 */
async function makePostRequestWithRetry(url: string, data: any, requestType: string): Promise<any> {
  let retryCount = 0;
  
  while (retryCount <= MAX_RETRIES) {
    try {
      logger.log(`Attempt ${retryCount + 1}/${MAX_RETRIES + 1} to send ${requestType}...`);
      
      // Set up the request with timeout
      const response = await axios.post(url, data, {
        headers: {
          'accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
          'Content-Type': 'application/json'
        },
        timeout: REQUEST_TIMEOUT_MS
      });
      
      logger.log(`✅ Successfully sent ${requestType}`);
      return response;
    } catch (error) {
      retryCount++;
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          logger.log(`⚠️ Request timeout for ${requestType}. Retry ${retryCount}/${MAX_RETRIES}...`);
        } else if (error.response) {
          logger.log(`⚠️ Server returned ${error.response.status} for ${requestType}. Retry ${retryCount}/${MAX_RETRIES}...`);
        } else {
          logger.log(`⚠️ Network error for ${requestType}: ${error.message}. Retry ${retryCount}/${MAX_RETRIES}...`);
        }
      } else {
        logger.log(`⚠️ Unknown error for ${requestType}. Retry ${retryCount}/${MAX_RETRIES}...`);
      }
      
      if (retryCount <= MAX_RETRIES) {
        // Wait before retrying
        logger.log(`Waiting ${RETRY_DELAY_MS}ms before next attempt...`);
        await setTimeout(RETRY_DELAY_MS);
      } else {
        logger.log(`❌ Failed to send ${requestType} after ${MAX_RETRIES + 1} attempts`);
        throw error;
      }
    }
  }
  
  // This should never be reached due to the throw in the loop
  throw new Error(`Failed to send ${requestType} after ${MAX_RETRIES + 1} attempts`);
}

export async function sendResults(badgeConfig: BadgeConfig, data: { basicHolders: string[], upgradedHolders?: string[], basicAddresses?: string[], upgradedAddresses?: string[], timestamp: string }, options: RunOptions, apiKey?: string): Promise<any> {
  // Get project-specific API key if project name is provided
  try {
    logger.log('Sending results to API...');
    
    // Check if project name is provided
    if (!badgeConfig.projectName) {
      throw new Error('Project name is required');
    }
    
    // Load project-specific configuration
    logger.log(`Loading configuration for project: ${badgeConfig.projectName}`);
    
    // Get API endpoints from config
    const API_BASE_URL = badgeConfig.api.baseUrl;
    const BASIC_ENDPOINT = badgeConfig.api.endpoints.basic;
    const UPGRADED_ENDPOINT = badgeConfig.api.endpoints.upgraded;
    
    // Check if basic badge holders should be excluded when they also have the upgraded badge
    const EXCLUDE_BASIC_FOR_UPGRADED = badgeConfig.excludeBasicForUpgraded;
    
    logger.verboseLog(`Using API endpoints for project ${badgeConfig.projectName}:`);
    logger.verboseLog(`- Base URL: ${API_BASE_URL}`);
    logger.verboseLog(`- Basic endpoint: ${BASIC_ENDPOINT}`);
    logger.verboseLog(`- Upgraded endpoint: ${UPGRADED_ENDPOINT}`);
    
    
    if (!apiKey && !options.dryRun) {
      throw new Error('API_KEY environment variable is not set');
    }
    
    // Prepare basic badge data
    let basicHandles;
    if (EXCLUDE_BASIC_FOR_UPGRADED) {
      // Get permanent accounts from config
      const permanentAccounts = badgeConfig.permanentAccounts || [];
      const permanentAccountsSet = new Set(permanentAccounts.map((handle: string) => handle.toLowerCase()));
      
      // Exclude basic badge holders who also have the upgraded badge, but preserve permanent accounts
      const upgradedSet = data.upgradedHolders ? new Set(data.upgradedHolders) : new Set<string>();
      basicHandles = data.basicHolders.filter((handle: string) => 
        !upgradedSet.has(handle) || permanentAccountsSet.has(handle.toLowerCase())
      );
      logger.log(`Excluding upgraded badge holders from basic list (${basicHandles.length} basic-only handles, permanent accounts preserved)`);
    } else {
      // Include all basic badge holders regardless of upgraded status
      basicHandles = [...new Set([...data.basicHolders])];
      logger.log(`Including all basic badge holders (${basicHandles.length} total handles)`);
    }
    
    const basicData = {
      handles: basicHandles
    };
    
    // Only create upgraded data if upgradedHolders exists
    const upgradedData = data.upgradedHolders ? {
      handles: data.upgradedHolders
    } : null;
    
    // Construct endpoints with key as query parameter
    const basicEndpoint = `${API_BASE_URL}/${BASIC_ENDPOINT}?key=${apiKey}`;
    const upgradedEndpoint = `${API_BASE_URL}/${UPGRADED_ENDPOINT}?key=${apiKey}`;
    
    // Check if this is a dry run
    if (options.dryRun) {
      logger.log('DRY RUN MODE: Printing JSON to console instead of sending to API');
      logger.log(`Export addresses flag: ${options.exportAddresses ? 'ENABLED' : 'DISABLED'}`);
      logger.log('\nBASIC BADGE DATA (would be sent to ' + `${API_BASE_URL}/${BASIC_ENDPOINT}` + '):')
      logger.log(JSON.stringify(basicData, null, 2));
      
      // Only log upgraded data if it exists
      if (upgradedData) {
        logger.log('\nUPGRADED DATA (would be sent to ' + `${API_BASE_URL}/${UPGRADED_ENDPOINT}` + '):');
        logger.log(JSON.stringify(upgradedData, null, 2));
      } else {
        logger.log('\nNo upgraded badge data available');
      }
      
      // Export addresses to files if the exportAddresses flag is set
      if (options.exportAddresses && data.basicAddresses) {
        exportWalletAddresses(
          badgeConfig.projectName,
          data.basicAddresses,
          data.upgradedAddresses,
          data.timestamp
        );
      }
      
      logger.log('\nDRY RUN COMPLETED - No data was sent to the API');
      return {
        basic: { status: 'dry-run', handles: basicData.handles.length },
        upgraded: upgradedData ? { status: 'dry-run', handles: upgradedData.handles.length } : { status: 'dry-run', handles: 0 }
      };
    } else {
      // Send data to both endpoints
      logger.log(`Sending basic badge holders to ${API_BASE_URL}/${BASIC_ENDPOINT}`);
      logger.log(`Basic badge holders: ${basicData.handles.length}`);
      
      // Make the POST request for basic badge holders with retry logic
      const basicResponse = await makePostRequestWithRetry(basicEndpoint, basicData, 'basic badge holders');
      
      // Only send upgraded data if it exists
      let upgradedResponse = null;
      if (upgradedData) {
        logger.log(`Sending upgraded badge holders to ${API_BASE_URL}/${UPGRADED_ENDPOINT}`);
        logger.log(`Upgraded badge holders: ${upgradedData.handles.length}`);
        
        // Make the POST request for upgraded badge holders with retry logic
        upgradedResponse = await makePostRequestWithRetry(upgradedEndpoint, upgradedData, 'upgraded badge holders');
      } else {
        logger.log('No upgraded badge data to send');
      }
      
      logger.log('Results sent successfully to both endpoints');
      return {
        basic: basicResponse.data,
        upgraded: upgradedResponse ? upgradedResponse.data : null
      };
    }
  } catch (error: any) {
    logger.error('Error sending results:', error.message || String(error));
    throw error;
  }
}
