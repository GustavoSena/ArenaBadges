import * as path from 'path';
import * as fs from 'fs';

/**
 * Load the application configuration file
 * @returns The application configuration object
 */
export function loadConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'scheduler.json');
    console.log(`Loading app config from ${configPath}`);
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('Error loading app config:', error);
    return { 
      scheduler: { 
        intervalHours: 6,
        leaderboardIntervalHours: 3
      }
    };
  }
}

/**
 * Load the tokens configuration file
 * @returns The tokens configuration object
 */
export function loadTokensConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'tokens.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('Error loading tokens config:', error);
    return { 
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