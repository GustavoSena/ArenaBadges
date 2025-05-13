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
export function loadTokensConfig() {
  try {
    // Use the new project-specific configuration system
    const appConfig = loadAppConfig();
    
    // Return a compatible configuration structure
    return { 
      scheduler: {
        intervalHours: appConfig.scheduler.badgeIntervalHours,
        leaderboardIntervalHours: appConfig.scheduler.leaderboardIntervalHours
      },
      api: { 
        baseUrl: appConfig.api.baseUrl,
        endpoints: {
          nftOnly: appConfig.api.endpoints.nftOnly,
          combined: appConfig.api.endpoints.combined
        },
        includeCombinedInNft: appConfig.api.includeCombinedInNft
      },
      nfts: appConfig.nfts,
      tokens: appConfig.tokens
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
          nftOnly: 'mu-tier-1',
          combined: 'mu-tier-2'
        }
      }
    };
  }
}