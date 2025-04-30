// Badge Scheduler Server
import * as dotenv from 'dotenv';
import express from 'express';
import { startScheduler } from '../services/schedulerService';

// Load environment variables
dotenv.config();

// Default port for the badge scheduler server
const PORT = process.env.BADGE_SERVER_PORT || 3000;

// Global variables to track scheduler status
declare global {
  var lastBadgeSchedulerRun: string | null;
  var nextBadgeSchedulerRun: string | null;
}

/**
 * Main function to start the badge scheduler server
 */
async function startBadgeSchedulerServer() {
  try {
    // Create Express app
    const app = express();

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'badge-scheduler',
        timestamp: new Date().toISOString()
      });
    });

    // Status endpoint
    app.get('/status', (req, res) => {
      res.status(200).json({
        status: 'running',
        service: 'badge-scheduler',
        lastRun: global.lastBadgeSchedulerRun || null,
        nextRun: global.nextBadgeSchedulerRun || null,
        timestamp: new Date().toISOString()
      });
    });

    // Manual trigger endpoint (protected)
    app.post('/trigger', (req, res) => {
      try {
        console.log('Manual trigger received for badge scheduler');
        // Get API key from environment
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
          throw new Error('API key is required. Set it as API_KEY environment variable.');
        }

        // Override the global runAndSendResults function to track last run time
        const runAndSendResults = require('./services/schedulerService').runAndSendResults;
        
        // Run the scheduler manually
        global.lastBadgeSchedulerRun = new Date().toISOString();
        runAndSendResults(apiKey)
          .then(() => {
            console.log('Manual badge scheduler run completed successfully');
          })
          .catch((error: any) => {
            console.error('Error in manual badge scheduler run:', error);
          });

        res.status(202).json({
          status: 'accepted',
          message: 'Badge scheduler triggered manually',
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Error triggering badge scheduler:', error);
        res.status(500).json({
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Start the scheduler with default configuration
    startScheduler({
      onSchedule: (nextRunTime: Date) => {
        global.nextBadgeSchedulerRun = nextRunTime.toISOString();
      },
      onRun: () => {
        global.lastBadgeSchedulerRun = new Date().toISOString();
      }
    });

    // Start the server
    app.listen(PORT, () => {
      console.log(`Badge Scheduler Server running on port ${PORT}`);
      console.log('Badge scheduler started successfully');
    });
  } catch (error) {
    console.error('Failed to start Badge Scheduler Server:', error);
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  startBadgeSchedulerServer();
}

export { startBadgeSchedulerServer };
