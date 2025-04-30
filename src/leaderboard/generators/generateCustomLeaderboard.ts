// Custom Leaderboard Generator
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import { generateAndSaveMuLeaderboard, generateAndSaveStandardLeaderboard } from '../services/leaderboardClassService';

// Load environment variables
dotenv.config();

// Define the command-line interface
const program = new Command();
program
  .option('-t, --type <type>', 'Type of leaderboard to generate (mu or standard)', 'mu')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-h, --help', 'Display help information')
  .parse(process.argv);

const options = program.opts();

// Show help if requested
if (options.help) {
  console.log(`
  Usage: npm run custom-leaderboard -- [options]
  
  Options:
    -t, --type <type>  Type of leaderboard to generate (mu or standard) (default: "mu")
    -v, --verbose      Show verbose output
    -h, --help         Display help information
  `);
  process.exit(0);
}

/**
 * Main function to generate a custom leaderboard
 */
async function generateCustomLeaderboard() {
  try {
    const type = options.type.toLowerCase();
    const verbose = options.verbose;
    
    console.log(`Generating ${type} leaderboard...`);
    console.log(`Verbose mode: ${options.verbose ? 'enabled' : 'disabled'}`);
    
    // Set verbose environment variable
    process.env.VERBOSE = options.verbose ? 'true' : 'false';
    
    let leaderboard;
    
    switch (type) {
      case 'mu':
        leaderboard = await generateAndSaveMuLeaderboard(verbose);
        break;
      case 'standard':
        leaderboard = await generateAndSaveStandardLeaderboard(verbose);
        break;
      default:
        console.error(`Unknown leaderboard type: ${type}`);
        process.exit(1);
    }
    
    // Print the top 5 entries
    console.log('\nTop 5 entries:');
    leaderboard.entries.slice(0, 5).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.twitterHandle || 'Unknown'}: ${entry.totalPoints.toFixed(2)} points`);
    });
    
    console.log('\nLeaderboard generation complete!');
  } catch (error) {
    console.error('Error generating custom leaderboard:', error);
    process.exit(1);
  }
}

// Run the generator if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  generateCustomLeaderboard();
}

export { generateCustomLeaderboard };
