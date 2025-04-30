import * as dotenv from 'dotenv';
import { generateAndSaveMuLeaderboard, generateAndSaveStandardLeaderboard } from './leaderboardClassService';
import { loadConfig } from '../utils/helpers';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Define leaderboard types
export enum LeaderboardType {
  STANDARD = 'standard',
  MU = 'mu'
}

// Interface for leaderboard scheduler configuration
export interface LeaderboardSchedulerConfig {
  leaderboardTypes?: LeaderboardType[];
  intervalMs?: number;
  runImmediately?: boolean;
  onSchedule?: (nextRunTime: Date) => void;
  onRun?: () => void;
}

// Interface for the scheduler configuration from config file
interface SchedulerConfig {
  intervalHours: number;
  leaderboardIntervalHours?: number;
  leaderboardTypes?: string[];
}

// Default configuration
const DEFAULT_CONFIG: LeaderboardSchedulerConfig = {
  leaderboardTypes: [LeaderboardType.MU],
  runImmediately: true
};

/**
 * Generate a specific type of leaderboard
 * @param type The type of leaderboard to generate
 */
async function generateLeaderboard(type: LeaderboardType): Promise<void> {
  console.log(`Generating ${type} leaderboard at ${new Date().toISOString()}`);
  
  try {
    switch (type) {
      case LeaderboardType.STANDARD:
        await generateAndSaveStandardLeaderboard();
        break;
      case LeaderboardType.MU:
        await generateAndSaveMuLeaderboard();
        break;
      default:
        console.warn(`Unknown leaderboard type: ${type}`);
        return;
    }
    
    console.log(`Successfully generated ${type} leaderboard at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Error generating ${type} leaderboard:`, error);
  }
}

/**
 * Run all configured leaderboard generations
 * @param types Array of leaderboard types to generate
 */
export async function runLeaderboardGeneration(types: LeaderboardType[]): Promise<void> {
  console.log(`Starting scheduled leaderboard generation at ${new Date().toISOString()}`);
  
  // Create a log entry for this run
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, `leaderboard_${new Date().toISOString().replace(/:/g, '-')}.log`);
  fs.writeFileSync(logFile, `Leaderboard generation started at ${new Date().toISOString()}\n`);
  
  // Generate each type of leaderboard
  for (const type of types) {
    try {
      await generateLeaderboard(type);
      fs.appendFileSync(logFile, `Successfully generated ${type} leaderboard\n`);
    } catch (error) {
      console.error(`Error generating ${type} leaderboard:`, error);
      fs.appendFileSync(logFile, `Error generating ${type} leaderboard: ${error}\n`);
    }
  }
  
  fs.appendFileSync(logFile, `Leaderboard generation completed at ${new Date().toISOString()}\n`);
  console.log(`Completed scheduled leaderboard generation at ${new Date().toISOString()}`);
}

/**
 * Starts the leaderboard scheduler to run at specified intervals
 * @param config Configuration for the leaderboard scheduler
 */
export function startLeaderboardScheduler(config: LeaderboardSchedulerConfig = DEFAULT_CONFIG): void {
  // Load configuration from config file
  const appConfig = loadConfig();
  const schedulerConfig: SchedulerConfig = appConfig.scheduler || { intervalHours: 24 };
  
  // Get configuration
  const leaderboardTypes = config.leaderboardTypes || DEFAULT_CONFIG.leaderboardTypes || [];
  const intervalHours = schedulerConfig.leaderboardIntervalHours || 3; // Default to 3 hours
  const intervalMs = config.intervalMs || (intervalHours * 60 * 60 * 1000);
  const runImmediately = config.runImmediately !== undefined ? config.runImmediately : DEFAULT_CONFIG.runImmediately;
  
  console.log(`Starting leaderboard scheduler to run every ${intervalHours} hours`);
  console.log(`Configured leaderboard type: MU`);
  
  // Run immediately on startup if configured
  if (runImmediately) {
    if (config.onRun) {
      config.onRun();
    }
    runLeaderboardGeneration(leaderboardTypes);
  }
  
  // Then schedule to run at the specified interval
  const nextRunTime = new Date(Date.now() + intervalMs);
  if (config.onSchedule) {
    config.onSchedule(nextRunTime);
  }
  
  setInterval(() => {
    if (config.onRun) {
      config.onRun();
    }
    runLeaderboardGeneration(leaderboardTypes);
    const nextRunTime = new Date(Date.now() + intervalMs);
    if (config.onSchedule) {
      config.onSchedule(nextRunTime);
    }
  }, intervalMs);
}
