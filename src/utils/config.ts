import * as fs from 'fs';
import * as path from 'path';
import { LeaderboardConfig, TokenWeight, NftWeight, LeaderboardOutput } from '../types/leaderboard';

// Token configuration
export interface TokenConfig {
  symbol: string;
  address: string;
  minBalance: number;
  decimals: number;
}

// NFT configuration
export interface NftConfig {
  name: string;
  address: string;
  collectionSize?: number;
  minBalance: number;
}

// Scheduler configuration
export interface SchedulerConfig {
  badgeIntervalHours: number;
  enableLeaderboard: boolean;
  leaderboardIntervalHours: number;
  leaderboardTypes: string[];
}

// API configuration
export interface ApiConfig {
  baseUrl: string;
  endpoints: {
    nftOnly: string;
    combined: string;
  };
  includeCombinedInNft: boolean;
}

// Project configuration
export interface ProjectConfig {
  projectId?: string;  // Optional identifier for the project
  activeProject?: string;  // Name of the active project configuration to use
}

// Main application config
export interface AppConfig {
  projectName: string;
  tokens: TokenConfig[];
  nfts: NftConfig[];
  scheduler: SchedulerConfig;
  api: ApiConfig;
  excludedAccounts: string[];
}

/**
 * Load the main application config
 * @param projectId Optional project ID to load a specific project configuration
 * @returns The application configuration
 */
export function loadAppConfig(projectId?: string): AppConfig {
  try {
    // First, load the main config to check for an active project
    const mainConfigPath = path.join(process.cwd(), 'config', 'config.json');
    let mainConfig: AppConfig & ProjectConfig;
    
    try {
      mainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8')) as AppConfig & ProjectConfig;
    } catch (error) {
      console.error('Error loading main config:', error);
      return getDefaultConfig();
    }
    
    // If a specific project ID is provided, use that
    const targetProject = projectId || mainConfig.activeProject;
    
    // If there's a specific project to load, try to load it
    if (targetProject) {
      try {
        const projectConfigPath = path.join(process.cwd(), 'config', 'projects', `${targetProject}.json`);
        console.log(`Loading project config from ${projectConfigPath}`);
        return JSON.parse(fs.readFileSync(projectConfigPath, 'utf8')) as AppConfig;
      } catch (projectError) {
        console.error(`Error loading project config for ${targetProject}:`, projectError);
        console.log('Falling back to main config');
      }
    }
    
    // If no project was specified or loading the project failed, use the main config
    console.log(`Loading app config from ${mainConfigPath}`);
    return mainConfig;
  } catch (error) {
    console.error('Error in loadAppConfig:', error);
    return getDefaultConfig();
  }
}

/**
 * Get the default configuration
 * @returns Default application configuration
 */
function getDefaultConfig(): AppConfig {
  return {
    projectName: "Default",
    tokens: [],
    nfts: [],
    scheduler: {
      badgeIntervalHours: 6,
      enableLeaderboard: true,
      leaderboardIntervalHours: 3,
      leaderboardTypes: ['standard']
    },
    api: {
      baseUrl: 'http://api.example.com/badges',
      endpoints: {
        nftOnly: 'nft-endpoint',
        combined: 'combined-endpoint'
      },
      includeCombinedInNft: true
    },
    excludedAccounts: []
  };
}

/**
 * Load a specific leaderboard config
 * @param type The type of leaderboard (e.g., 'standard', 'mu')
 * @returns The leaderboard configuration
 */
export function loadLeaderboardConfig(type: string): LeaderboardConfig {
  try {
    // First try to load from the new project-specific configuration system
    try {
      const appConfig = loadAppConfig();
      
      // Check if the project has leaderboard enabled
      if (!appConfig.scheduler.enableLeaderboard) {
        throw new Error(`Leaderboard is disabled for this project`);
      }
      
      // Try to load from the leaderboards directory first (for backward compatibility)
      const configPath = path.join(process.cwd(), 'config', 'leaderboards', `${type}.json`);
      console.log(`Loading ${type} leaderboard config from ${configPath}`);
      return JSON.parse(fs.readFileSync(configPath, 'utf8')) as LeaderboardConfig;
    } catch (projectError) {
      console.error(`Error loading ${type} leaderboard config from project:`, projectError);
      throw projectError;
    }
  } catch (error) {
    console.error(`Error loading ${type} leaderboard config:`, error);
    throw new Error(`Failed to load ${type} leaderboard configuration`);
  }
}

/**
 * Get the list of available leaderboard types
 * @returns Array of available leaderboard types
 */
export function getAvailableLeaderboardTypes(): string[] {
  try {
    const leaderboardsDir = path.join(process.cwd(), 'config', 'leaderboards');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(leaderboardsDir)) {
      fs.mkdirSync(leaderboardsDir, { recursive: true });
      return [];
    }
    
    // Read all JSON files in the directory
    const files = fs.readdirSync(leaderboardsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
    
    return files;
  } catch (error) {
    console.error('Error getting available leaderboard types:', error);
    return [];
  }
}
