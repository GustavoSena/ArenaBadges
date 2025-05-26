import * as fs from 'fs';
import * as path from 'path';
import { LeaderboardConfig } from '../types/leaderboard';
import { BadgeConfig } from '../types/badge';
import logger from './logger';

// Cache for configurations to avoid multiple disk reads
const configCache: {
  appConfig: { [key: string]: AppConfig | null };
} = {
  appConfig: {},
};

/**
 * Scheduler configuration for a project
 */
export interface ProjectSchedulerConfig {
  /** Hours between badge update runs */
  badgeIntervalHours: number;
  /** Hours to wait before retry after failure */
  badgeRetryIntervalHours?: number;
  /** Hours between leaderboard update runs */
  leaderboardIntervalHours?: number;
  /** Hours to wait before retry after leaderboard failure */
  leaderboardRetryIntervalHours?: number;
}

/**
 * Configuration for a single project
 */
export interface ProjectConfig {
  /** Whether leaderboard generation is enabled for this project */
  enableLeaderboard?: boolean;
  /** Scheduler configuration */
  scheduler: ProjectSchedulerConfig;
  /** Path to the wallet mapping file for this project */
  walletMappingFile: string;
}


export interface AppConfig {
  projectName: string;
  projectConfig: ProjectConfig;
  badgeConfig: BadgeConfig;
  // Leaderboard specific configuration
  leaderboardConfig?: LeaderboardConfig;
}

export interface MainConfig {
  projects: { [projectId: string]: ProjectConfig };
}

/**
 * Load the main application config
 * @param projectName Optional project ID to load a specific project configuration
 * @returns The application configuration
 */
export function loadAppConfig(projectName: string): AppConfig {
  
  // Check if we have this config in cache
  if (configCache.appConfig[projectName]) {
    return configCache.appConfig[projectName] as AppConfig;
  }
  
  try {
    // Use the project ID provided as parameter
    const targetProject = projectName;
    
    const mainConfigPath = path.join(process.cwd(), 'config', 'config.json');
    logger.log(`Loading app config from ${mainConfigPath}`);
    const mainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8')) as MainConfig;
    // Cache the result
    const projectConfig = mainConfig.projects[targetProject];
    const badgeConfig = loadBadgeConfig(targetProject);
    const appConfig: AppConfig = {
      projectName: targetProject,
      projectConfig,
      badgeConfig
    };
    if(projectConfig.enableLeaderboard){
      appConfig.leaderboardConfig = loadLeaderboardConfig(targetProject);
    }
  
    configCache.appConfig[projectName] = appConfig;
    return appConfig;
   
    
  } catch (error) {
    logger.error('Error in loadAppConfig:', error);
    throw new Error(`Failed to load application configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load a specific leaderboard config
 * @param type The type of leaderboard
 * @returns The leaderboard configuration
 */
export function loadLeaderboardConfig(type: string): LeaderboardConfig {

  try {
      // Try to load from the leaderboards directory first (for backward compatibility)
      const configPath = path.join(process.cwd(), 'config', 'leaderboards', `${type}.json`);
      logger.log(`Loading ${type} leaderboard config from ${configPath}`);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as LeaderboardConfig;
      
      return config;

  } catch (error) {
    logger.error(`Error loading ${type} leaderboard config:`, error);
    throw new Error(`Failed to load ${type} leaderboard configuration`);
  }
}

/**
 * Load a specific badge config
 * @param type The type of badge
 * @returns The badge configuration or null if not found
 */
export function loadBadgeConfig(type: string): any | null {
  
  try {
    const configPath = path.join(process.cwd(), 'config', 'badges', `${type}.json`);
    if (!fs.existsSync(configPath)) {
      logger.log(`Badge config for ${type} not found at ${configPath}`);
      throw new Error(`Badge config for ${type} not found at ${configPath}`);
    }
    
    logger.log(`Loading ${type} badge config from ${configPath}`);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    return config;
  } catch (error) {
    logger.error(`Error loading ${type} badge config:`, error);
    throw new Error(`Failed to load ${type} badge configuration`);
  }
}
