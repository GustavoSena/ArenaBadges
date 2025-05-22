// Send Results Module
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { BadgeConfig } from '../../types/badge';
import { RunOptions } from '../services/schedulerService';
import { ensureOutputDirectory } from '../../utils/helpers';

/**
 * Send results to the API endpoints
 * @param badgeConfig The badge configuration
 * @param apiKey The API key to use for authentication
 * @param data The data to send
 * @param options Options for sending results
 * @param options.dryRun If true, print JSON to console instead of sending to API
 * @returns Promise resolving to the API response
 */
export async function sendResults(badgeConfig: BadgeConfig, apiKey: string, data: { basicHolders: string[], upgradedHolders: string[], basicAddresses?: string[], upgradedAddresses?: string[], timestamp: string }, options: RunOptions): Promise<any> {
  // Get project-specific API key if project name is provided
  try {
    console.log('Sending results to API...');
    
    // Check if project name is provided
    if (!badgeConfig.projectName) {
      throw new Error('Project name is required');
    }
    
    // Load project-specific configuration
    console.log(`Loading configuration for project: ${badgeConfig.projectName}`);
    
    // Get API endpoints from config
    const API_BASE_URL = badgeConfig.api.baseUrl;
    const BASIC_ENDPOINT = badgeConfig.api.endpoints.basic;
    const UPGRADED_ENDPOINT = badgeConfig.api.endpoints.upgraded;
    
    // Check if basic badge holders should be excluded when they also have the upgraded badge
    const EXCLUDE_BASIC_FOR_UPGRADED = badgeConfig.excludeBasicForUpgraded;
    
    console.log(`Using API endpoints for project ${badgeConfig.projectName}:`);
    console.log(`- Base URL: ${API_BASE_URL}`);
    console.log(`- Basic endpoint: ${BASIC_ENDPOINT}`);
    console.log(`- Upgraded endpoint: ${UPGRADED_ENDPOINT}`);
    
    
    if (!apiKey) {
      throw new Error('API_KEY environment variable is not set');
    }
    
    // Prepare basic badge data
    let basicHandles;
    if (EXCLUDE_BASIC_FOR_UPGRADED) {
      // Get permanent accounts from config
      const permanentAccounts = badgeConfig.permanentAccounts || [];
      const permanentAccountsSet = new Set(permanentAccounts.map((handle: string) => handle.toLowerCase()));
      
      // Exclude basic badge holders who also have the upgraded badge, but preserve permanent accounts
      const upgradedSet = new Set(data.upgradedHolders);
      basicHandles = data.basicHolders.filter((handle: string) => 
        !upgradedSet.has(handle) || permanentAccountsSet.has(handle.toLowerCase())
      );
      console.log(`Excluding upgraded badge holders from basic list (${basicHandles.length} basic-only handles, permanent accounts preserved)`);
    } else {
      // Include all basic badge holders regardless of upgraded status
      basicHandles = [...new Set([...data.basicHolders])];
      console.log(`Including all basic badge holders (${basicHandles.length} total handles)`);
    }
    
    const basicData = {
      handles: basicHandles,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    const upgradedData = {
      handles: data.upgradedHolders,
      timestamp: data.timestamp || new Date().toISOString()
    };
    
    // Construct endpoints with key as query parameter
    const basicEndpoint = `${API_BASE_URL}/${BASIC_ENDPOINT}?key=${apiKey}`;
    const upgradedEndpoint = `${API_BASE_URL}/${UPGRADED_ENDPOINT}?key=${apiKey}`;
    
    // Check if this is a dry run
    if (options.dryRun) {
      console.log('DRY RUN MODE: Printing JSON to console instead of sending to API');
      console.log(`Export addresses flag: ${options.exportAddresses ? 'ENABLED' : 'DISABLED'}`);
      console.log('\nBASIC BADGE DATA (would be sent to ' + `${API_BASE_URL}/${BASIC_ENDPOINT}` + '):')
      console.log(JSON.stringify(basicData, null, 2));
      
      console.log('\nUPGRADED DATA (would be sent to ' + `${API_BASE_URL}/${UPGRADED_ENDPOINT}` + '):');
      console.log(JSON.stringify(upgradedData, null, 2));
      
      // Export addresses to files if the exportAddresses flag is set
      if (options.exportAddresses) {
        console.log('\nEXPORTING ADDRESSES: Saving wallet addresses to files');
        
        // Create output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'output', 'addresses');
        ensureOutputDirectory(outputDir);
        
        // Generate timestamp for filenames
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        
        // Check if we have wallet addresses available
        if (!data.basicAddresses || !data.upgradedAddresses) {
          console.log('WARNING: Wallet addresses not available in the data. Cannot export wallet addresses.');
          return;
        }
        
        // Save basic badge holder wallet addresses
        const basicAddressesFile = path.join(outputDir, `${badgeConfig.projectName}_basic_wallet_addresses_${timestamp}.json`);
        fs.writeFileSync(basicAddressesFile, JSON.stringify({
          addresses: data.basicAddresses,
          count: data.basicAddresses.length,
          timestamp: data.timestamp,
          type: 'basic',
          project: badgeConfig.projectName
        }, null, 2));
        console.log(`Exported ${data.basicAddresses.length} basic badge holder wallet addresses to ${basicAddressesFile}`);
        
        // Save upgraded badge holder wallet addresses
        const upgradedAddressesFile = path.join(outputDir, `${badgeConfig.projectName}_upgraded_wallet_addresses_${timestamp}.json`);
        fs.writeFileSync(upgradedAddressesFile, JSON.stringify({
          addresses: data.upgradedAddresses,
          count: data.upgradedAddresses.length,
          timestamp: data.timestamp,
          type: 'upgraded',
          project: badgeConfig.projectName
        }, null, 2));
        console.log(`Exported ${data.upgradedAddresses.length} upgraded badge holder wallet addresses to ${upgradedAddressesFile}`);
        
        // Save all unique wallet addresses (combined)
        const allAddresses = [...new Set([...data.basicAddresses, ...data.upgradedAddresses])];
        const allAddressesFile = path.join(outputDir, `${badgeConfig.projectName}_all_wallet_addresses_${timestamp}.json`);
        fs.writeFileSync(allAddressesFile, JSON.stringify({
          addresses: allAddresses,
          count: allAddresses.length,
          timestamp: data.timestamp,
          type: 'all',
          project: badgeConfig.projectName
        }, null, 2));
        console.log(`Exported ${allAddresses.length} total unique badge holder wallet addresses to ${allAddressesFile}`);
      }
      
      console.log('\nDRY RUN COMPLETED - No data was sent to the API');
      return {
        basic: { status: 'dry-run', handles: basicData.handles.length },
        upgraded: { status: 'dry-run', handles: upgradedData.handles.length }
      };
    } else {
      // Send data to both endpoints
      console.log(`Sending basic badge holders to ${API_BASE_URL}/${BASIC_ENDPOINT}`);
      console.log(`Basic badge holders: ${basicData.handles.length}`);
      const basicResponse = await axios.post(basicEndpoint, basicData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Sending upgraded badge holders to ${API_BASE_URL}/${UPGRADED_ENDPOINT}`);
      console.log(`Upgraded badge holders: ${upgradedData.handles.length}`);
      const upgradedResponse = await axios.post(upgradedEndpoint, upgradedData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Results sent successfully to both endpoints');
      return {
        basic: basicResponse.data,
        upgraded: upgradedResponse.data
      };
    }
  } catch (error: any) {
    console.error('Error sending results:', error.message || String(error));
    throw error;
  }
}
