// Helper functions for the Badge Server
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load configuration from config file
 * @returns Configuration object
 */
export function loadConfig(): any {
  try {
    // Default configuration
    const defaultConfig = {
      scheduler: {
        intervalHours: 24
      }
    };
    
    // Try to load config from file
    const configPath = path.join(process.cwd(), 'config', 'badges.json');
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
    
    // If config file doesn't exist, create it with default values
    const configDir = path.join(process.cwd(), 'config');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Created default config file at ${configPath}`);
    
    return defaultConfig;
  } catch (error) {
    console.error('Error loading config:', error);
    
    // Return default config if there's an error
    return {
      scheduler: {
        intervalHours: 24
      }
    };
  }
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
