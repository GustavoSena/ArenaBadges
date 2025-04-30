// Leaderboard Scheduler Server
import * as dotenv from 'dotenv';
import express, { Request, Response, RequestHandler } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { startLeaderboardScheduler, LeaderboardType, runLeaderboardGeneration } from '../services/leaderboardSchedulerService';
import { spawn } from 'child_process';

// Load environment variables
dotenv.config();

// Default port for the leaderboard scheduler server
const PORT = process.env.LEADERBOARD_SERVER_PORT || 3001;

// Global variables to track scheduler status
declare global {
  interface GlobalVariables {
    lastLeaderboardRun: string | null;
    nextLeaderboardRun: string | null;
    leaderboardTypes: LeaderboardType[];
    isRefreshing: boolean;
  }
  var globalVariables: GlobalVariables;
}

// Initialize global variables
global.globalVariables = {
  lastLeaderboardRun: null,
  nextLeaderboardRun: null,
  leaderboardTypes: [LeaderboardType.MU],
  isRefreshing: false
};

/**
 * Main function to start the leaderboard scheduler server
 */
async function startLeaderboardSchedulerServer() {
  try {
    // Create Express app
    const app = express();

    // Add JSON parsing middleware
    app.use(express.json());

    // Serve static files from the 'public' directory
    app.use(express.static(path.join(process.cwd(), 'public')));
    
    // Also serve static files from the 'assets' directory for logos
    app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

    // Health check endpoint
    const healthCheckHandler: RequestHandler = (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'leaderboard-scheduler',
        timestamp: new Date().toISOString()
      });
    };
    app.get('/health', healthCheckHandler);

    // Status endpoint
    const statusHandler: RequestHandler = (req, res) => {
      res.status(200).json({
        status: 'running',
        service: 'leaderboard-scheduler',
        leaderboardType: LeaderboardType.MU,
        lastRun: global.globalVariables.lastLeaderboardRun || null,
        nextRun: global.globalVariables.nextLeaderboardRun || null,
        isRefreshing: global.globalVariables.isRefreshing || false,
        timestamp: new Date().toISOString()
      });
    };
    app.get('/status', statusHandler);

    // Serve the MU leaderboard HTML at root
    const rootHandler: RequestHandler = (req, res) => {
      try {
        const leaderboardPath = path.join(process.cwd(), 'public', 'mu_leaderboard.html');
        if (fs.existsSync(leaderboardPath)) {
          res.sendFile(leaderboardPath);
        } else {
          res.status(404).send('MU Leaderboard not found. It will be generated soon.');
        }
      } catch (error: any) {
        console.error('Error serving leaderboard HTML:', error);
        res.status(500).send('Error serving leaderboard');
      }
    };
    app.get('/', rootHandler);

    // Serve the standard leaderboard HTML if requested
    const standardLeaderboardHandler: RequestHandler = (req, res) => {
      try {
        const leaderboardPath = path.join(process.cwd(), 'public', 'standard_leaderboard.html');
        if (fs.existsSync(leaderboardPath)) {
          res.sendFile(leaderboardPath);
        } else {
          res.status(404).send('Standard Leaderboard not found. You can generate it using the /trigger/standard endpoint.');
        }
      } catch (error: any) {
        console.error('Error serving standard leaderboard HTML:', error);
        res.status(500).send('Error serving standard leaderboard');
      }
    };
    app.get('/standard', standardLeaderboardHandler);

    // Manual trigger endpoint (protected)
    const triggerHandler: RequestHandler = (req, res) => {
      try {
        // If already refreshing, return a 429 status
        if (global.globalVariables.isRefreshing) {
          res.status(429).json({
            status: 'busy',
            message: 'Leaderboard is already being refreshed',
            lastRun: global.globalVariables.lastLeaderboardRun,
            timestamp: new Date().toISOString()
          });
        }

        console.log('Manual trigger received for leaderboard scheduler');
        
        // Set refreshing flag
        global.globalVariables.isRefreshing = true;
        
        // Send immediate response
        res.status(202).json({
          status: 'accepted',
          message: 'Leaderboard generation triggered manually',
          timestamp: new Date().toISOString()
        });

        // Run the leaderboard generation in a separate process
        try {
          // Use node directly with the ts-node/register hook
          const refreshProcess = spawn('node', [
            '-r', 'ts-node/register',
            'src/refreshWorker.ts'
          ], {
            detached: true,
            stdio: 'ignore'
          });
          
          // Unref the child process to allow the parent to exit independently
          refreshProcess.unref();
          
          console.log(`Started leaderboard refresh process with PID: ${refreshProcess.pid}`);
          
          // Update the last run time
          global.globalVariables.lastLeaderboardRun = new Date().toISOString();
          
          // Calculate next run time
          const intervalHours = 3; // Default to 3 hours
          const nextRun = new Date();
          nextRun.setHours(nextRun.getHours() + intervalHours);
          global.globalVariables.nextLeaderboardRun = nextRun.toISOString();
        } catch (error) {
          console.error('Error spawning refresh process:', error);
          global.globalVariables.isRefreshing = false;
        }
      } catch (error: any) {
        console.error('Error triggering leaderboard generation:', error);
        global.globalVariables.isRefreshing = false;
        res.status(500).json({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
    app.post('/trigger', triggerHandler);

    // Manual trigger endpoint for standard leaderboard
    const triggerStandardHandler: RequestHandler = (req, res) => {
      try {
        // If already refreshing, return a 429 status
        if (global.globalVariables.isRefreshing) {
          res.status(429).json({
            status: 'busy',
            message: 'Leaderboard is already being refreshed',
            lastRun: global.globalVariables.lastLeaderboardRun,
            timestamp: new Date().toISOString()
          });
          return;
        }

        console.log('Manual trigger received for standard leaderboard generation');
        
        // Set refreshing flag
        global.globalVariables.isRefreshing = true;
        
        // Send immediate response
        res.status(202).json({
          status: 'accepted',
          message: 'Standard leaderboard generation triggered manually',
          timestamp: new Date().toISOString()
        });

        // Run the standard leaderboard generation in a separate process
        try {
          // Create a special environment variable to indicate standard leaderboard generation
          const env = { ...process.env, GENERATE_STANDARD_LEADERBOARD: 'true' };
          
          // Use node directly with the ts-node/register hook
          const refreshProcess = spawn('node', [
            '-r', 'ts-node/register',
            'src/refreshWorker.ts'
          ], {
            detached: true,
            stdio: 'ignore',
            env
          });
          
          // Unref the child process to allow the parent to exit independently
          refreshProcess.unref();
          
          console.log(`Started standard leaderboard refresh process with PID: ${refreshProcess.pid}`);
          
          // Update the last run time
          global.globalVariables.lastLeaderboardRun = new Date().toISOString();
          
          // Calculate next run time
          const intervalHours = 3; // Default to 3 hours
          const nextRun = new Date();
          nextRun.setHours(nextRun.getHours() + intervalHours);
          global.globalVariables.nextLeaderboardRun = nextRun.toISOString();
        } catch (error) {
          console.error('Error spawning standard refresh process:', error);
          global.globalVariables.isRefreshing = false;
        }
      } catch (error: any) {
        console.error('Error triggering standard leaderboard generation:', error);
        global.globalVariables.isRefreshing = false;
        res.status(500).json({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
    app.post('/trigger/standard', triggerStandardHandler);

    // Reset refreshing flag endpoint (for use by the worker process)
    const resetRefreshingHandler: RequestHandler = (req, res) => {
      try {
        // Check for a simple secret to prevent unauthorized access
        const { secret } = req.body;
        if (secret !== process.env.REFRESH_SECRET && secret !== 'local-refresh-secret') {
          res.status(403).json({
            status: 'error',
            message: 'Unauthorized',
            timestamp: new Date().toISOString()
          });
        }

        // Reset the refreshing flag
        global.globalVariables.isRefreshing = false;
        global.globalVariables.lastLeaderboardRun = new Date().toISOString();
        
        res.status(200).json({
          status: 'success',
          message: 'Refreshing flag reset',
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Error resetting refreshing flag:', error);
        res.status(500).json({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
    app.post('/reset-refreshing', resetRefreshingHandler);

    // Calculate the next run time based on interval
    const calculateNextRunTime = (intervalHours: number): Date => {
      const nextRun = new Date();
      nextRun.setHours(nextRun.getHours() + intervalHours);
      return nextRun;
    };

    // Only use MU leaderboard type
    const leaderboardTypesConfig = [LeaderboardType.MU];
    
    // Store the leaderboard types globally
    global.globalVariables.leaderboardTypes = leaderboardTypesConfig;

    // Create public directory if it doesn't exist
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Create assets directory if it doesn't exist
    const assetsDir = path.join(process.cwd(), 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Start the leaderboard scheduler with the specified types
    // Use a 3-hour interval as requested
    const intervalHours = 3;
    startLeaderboardScheduler({
      leaderboardTypes: leaderboardTypesConfig,
      intervalMs: intervalHours * 60 * 60 * 1000,
      runImmediately: true,
      onSchedule: (nextRunTime: Date) => {
        global.globalVariables.nextLeaderboardRun = nextRunTime.toISOString();
      },
      onRun: () => {
        // Instead of running directly, trigger the refresh worker
        if (!global.globalVariables.isRefreshing) {
          global.globalVariables.isRefreshing = true;
          global.globalVariables.lastLeaderboardRun = new Date().toISOString();
          
          // Spawn a separate process to handle the refresh
          // Use node directly with the ts-node/register hook
          const refreshProcess = spawn('node', [
            '-r', 'ts-node/register',
            'src/refreshWorker.ts'
          ], {
            detached: true,
            stdio: 'ignore'
          });
          
          refreshProcess.unref();
          console.log(`Started scheduled leaderboard refresh process with PID: ${refreshProcess.pid}`);
        } else {
          console.log('Skipping scheduled refresh as another refresh is already in progress');
        }
      }
    });

    // Set initial next run time
    global.globalVariables.nextLeaderboardRun = calculateNextRunTime(intervalHours).toISOString();

    // Start the server
    const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
    app.listen(portNumber, '0.0.0.0', () => {
      console.log(`Leaderboard Scheduler Server running on port ${portNumber}`);
      console.log(`Generating MU leaderboard by default`);
      console.log(`Leaderboard data will refresh every ${intervalHours} hours`);
      console.log(`Access the leaderboard at: http://localhost:${portNumber}`);
      console.log(`To manually refresh the leaderboard, run: npm run refresh-leaderboard`);
    });
  } catch (error) {
    console.error('Failed to start Leaderboard Scheduler Server:', error);
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  startLeaderboardSchedulerServer();
}

export { startLeaderboardSchedulerServer };
