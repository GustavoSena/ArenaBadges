import { loadAppConfig } from '../../utils/config';


/**
 * Load the tokens configuration file using the new project-specific configuration system
 * @returns The tokens configuration object
 */
export function loadProjectConfig(projectId?: string) {
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
          : (appConfig.scheduler?.badgeIntervalHours || 6),
        retryIntervalHours: appConfig.scheduler?.badgeRetryIntervalHours || 2
      },
      api: { 
        baseUrl: appConfig.api.baseUrl,
        endpoints: {
          basic: appConfig.api.endpoints.basic,
          upgraded: appConfig.api.endpoints.upgraded
        },
        includeBasicForUpgraded: appConfig.api.excludeBasicForUpgraded === undefined ? true : !appConfig.api.excludeBasicForUpgraded
      },
      nfts: appConfig.badges?.basic?.nfts || [],
      tokens: appConfig.badges?.basic?.tokens || []
    };
  } catch (error) {
    console.error('Error loading project config:', error);
    throw error;
  }
}