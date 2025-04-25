import * as dotenv from 'dotenv';
import { startScheduler } from './services/schedulerService';

// Load environment variables
dotenv.config();

// Start the scheduler
try {
  startScheduler({
    apiKey: process.env.API_KEY
  });
  
  console.log('Scheduler started successfully');
  console.log('Press Ctrl+C to stop the scheduler');
} catch (error) {
  console.error('Failed to start scheduler:', error);
  process.exit(1);
}
