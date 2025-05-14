import * as path from 'path';
import * as fs from 'fs';
import { loadAppConfig } from '../../utils/config';

/**
 * Load the application configuration file
 * @returns The application configuration object
 * @deprecated Use loadTokensConfig instead which uses the new project-specific configuration system
 */
export function loadConfig() {
  console.warn('Warning: loadConfig is deprecated. Use loadTokensConfig instead.');
  return loadTokensConfig();
}

/**
 * Load the tokens configuration file using the new project-specific configuration system
 * @returns The tokens configuration object
 */
export function loadTokensConfig(projectId?: string) {
  try {
    // Use the new project-specific configuration system
    const appConfig = loadAppConfig(projectId);
    
    // Check if we have a badge config structure or a main config structure
    const isBadgeConfig = appConfig.badges && appConfig.api;
    
    // Return a compatible configuration structure
    return { 
      scheduler: {
        intervalHours: isBadgeConfig 
          ? (appConfig.scheduler?.badgeIntervalHours || 6)
          : (appConfig.scheduler?.badgeIntervalHours || 6)
      },
      api: { 
        baseUrl: appConfig.api?.baseUrl || 'http://api.arena.social/badges',
        endpoints: {
          nftOnly: appConfig.api?.endpoints?.basic || 'basic-tier',
          combined: appConfig.api?.endpoints?.upgraded || 'upgraded-tier'
        },
        includeCombinedInNft: appConfig.api?.excludeBasicForUpgraded === undefined ? true : !appConfig.api.excludeBasicForUpgraded
      },
      nfts: appConfig.badges?.basic?.nfts || [],
      tokens: appConfig.badges?.basic?.tokens || []
    };
  } catch (error) {
    console.error('Error loading project config:', error);
    return { 
      scheduler: {
        intervalHours: 6,
        leaderboardIntervalHours: 3
      },
      api: { 
        baseUrl: 'http://api.arena.social/badges',
        endpoints: {
          nftOnly: 'basic-tier',
          combined: 'upgraded-tier'
        },
        includeCombinedInNft: true
      },
      nfts: [],
      tokens: []
    };
  }
}