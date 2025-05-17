import * as fs from 'fs';
import * as path from 'path';
import { LeaderboardConfig } from '../types/leaderboard';

// Cache for configurations to avoid multiple disk reads
const configCache: {
  appConfig: { [key: string]: AppConfig | null };
  leaderboardConfig: { [key: string]: LeaderboardConfig | null };
  badgeConfig: { [key: string]: any | null };
} = {
  appConfig: {},
  leaderboardConfig: {},
  badgeConfig: {}
};

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

// Badge requirement configuration
export interface BadgeRequirement {
  tokens?: TokenConfig[];
  nfts?: NftConfig[];
}

// Badge configuration
export interface BadgeConfig {
  basic: BadgeRequirement;
  upgraded?: BadgeRequirement;
  sumOfBalances?: boolean;
  walletMappingFile?: string;
}

// Scheduler configuration
export interface SchedulerConfig {
  badgeIntervalHours: number;
  enableLeaderboard: boolean;
  leaderboardIntervalHours: number;
  leaderboardTypes: string[];
  // Retry intervals for error handling
  badgeRetryIntervalHours?: number;
  leaderboardRetryIntervalHours?: number;
}

// API configuration
export interface ApiConfig {
  baseUrl: string;
  endpoints: {
    basic: string;
    upgraded: string;
  };
  excludeBasicForUpgraded: boolean;
}

// Project configuration
export interface ProjectConfig {
  projectId?: string;  // Optional identifier for the project
  activeProject?: string;  // Name of the active project configuration to use
}

// Leaderboard configuration
export interface LeaderboardAppConfig {
  sumOfBalances?: boolean;
  walletMappingFile?: string;
}

// Main application config
export interface AppConfig {
  projectName: string;
  badges: BadgeConfig;
  scheduler: SchedulerConfig;
  api: ApiConfig;
  excludedAccounts: string[];
  permanentAccounts?: string[];
  // For balance summing feature
  sumOfBalances?: boolean;
  walletMappingFile?: string;
  // Leaderboard specific configuration
  leaderboard?: LeaderboardAppConfig;
  // For backward compatibility
  tokens?: TokenConfig[];
  nfts?: NftConfig[];
}

/**
 * Load the main application config
 * @param projectId Optional project ID to load a specific project configuration
 * @returns The application configuration
 */
export function loadAppConfig(projectId?: string): AppConfig {
  const cacheKey = projectId || 'default';
  
  // Check if we have this config in cache
  if (configCache.appConfig[cacheKey]) {
    return configCache.appConfig[cacheKey] as AppConfig;
  }
  
  try {
    // Use the project ID provided as parameter
    const targetProject = projectId;
    
    // If a specific project is specified, try to load its badge configuration
    if (targetProject) {
      try {
        // Try to load from the badges directory
        const badgeConfigPath = path.join(process.cwd(), 'config', 'badges', `${targetProject}.json`);
        console.log(`Loading badge config for project ${targetProject} from ${badgeConfigPath}`);
        
        if (fs.existsSync(badgeConfigPath)) {
          const badgeConfig = JSON.parse(fs.readFileSync(badgeConfigPath, 'utf8'));
          // Cache the result
          configCache.appConfig[cacheKey] = badgeConfig as AppConfig;
          return badgeConfig as AppConfig;
        } else {
          console.error(`Badge config file not found for project ${targetProject} at ${badgeConfigPath}`);
        }
      } catch (projectError) {
        console.error(`Error loading badge config for ${targetProject}:`, projectError);
      }
    }
    
    // If no project was specified or loading the project failed, try to load the main config
    try {
      const mainConfigPath = path.join(process.cwd(), 'config', 'config.json');
      console.log(`Loading app config from ${mainConfigPath}`);
      const mainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8')) as AppConfig & ProjectConfig;
      // Cache the result
      configCache.appConfig[cacheKey] = mainConfig;
      return mainConfig;
    } catch (mainConfigError) {
      console.error('Error loading main config:', mainConfigError);
    }
    
    // If all else fails, throw an error
    throw new Error(`Configuration not found for project ${projectId || 'default'}`);
  } catch (error) {
    console.error('Error in loadAppConfig:', error);
    throw new Error(`Failed to load application configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load a specific leaderboard config
 * @param type The type of leaderboard (e.g., 'standard', 'mu')
 * @returns The leaderboard configuration
 */
export function loadLeaderboardConfig(type: string): LeaderboardConfig {
  // Check if we have this config in cache
  if (configCache.leaderboardConfig[type]) {
    return configCache.leaderboardConfig[type] as LeaderboardConfig;
  }
  
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
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as LeaderboardConfig;
      
      // Cache the result
      configCache.leaderboardConfig[type] = config;
      return config;
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

/**
 * Load a specific badge config
 * @param type The type of badge (e.g., 'mu')
 * @returns The badge configuration or null if not found
 */
export function loadBadgeConfig(type: string): any | null {
  // Check if we have this config in cache
  if (configCache.badgeConfig[type] !== undefined) {
    return configCache.badgeConfig[type];
  }
  
  try {
    const configPath = path.join(process.cwd(), 'config', 'badges', `${type}.json`);
    if (!fs.existsSync(configPath)) {
      console.log(`Badge config for ${type} not found at ${configPath}`);
      // Cache the null result
      configCache.badgeConfig[type] = null;
      return null;
    }
    
    console.log(`Loading ${type} badge config from ${configPath}`);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Cache the result
    configCache.badgeConfig[type] = config;
    return config;
  } catch (error) {
    console.error(`Error loading ${type} badge config:`, error);
    // Cache the null result
    configCache.badgeConfig[type] = null;
    return null;
  }
}

/**
 * Check if a project exists by checking for badge and leaderboard configurations
 * @param projectName The name of the project to check
 * @returns An object with flags indicating which configurations exist
 */
export function checkProjectExists(projectName: string): { badge: boolean, leaderboard: boolean } {
  const badgeConfigPath = path.join(process.cwd(), 'config', 'badges', `${projectName}.json`);
  const leaderboardConfigPath = path.join(process.cwd(), 'config', 'leaderboards', `${projectName}.json`);
  
  const badgeExists = fs.existsSync(badgeConfigPath);
  const leaderboardExists = fs.existsSync(leaderboardConfigPath);
  
  return {
    badge: badgeExists,
    leaderboard: leaderboardExists
  };
}
