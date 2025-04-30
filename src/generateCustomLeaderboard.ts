import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import { generateAndSaveMuLeaderboard, generateAndSaveStandardLeaderboard } from './services/leaderboardClassService';

// Define the program
const program = new Command();

// Define the options
program
  .option('-t, --type <type>', 'Type of leaderboard to generate (mu, standard)', 'mu')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-h, --help', 'Display help information');

// Parse the arguments
program.parse(process.argv);

// Get the options
const options = program.opts();

// Show help if requested
if (options.help) {
  console.log(`
  Usage: npm run custom-leaderboard -- [options]
  
  Options:
    -t, --type <type>  Type of leaderboard to generate (mu, standard) (default: "mu")
    -v, --verbose      Show verbose output
    -h, --help         Display help information
  `);
  process.exit(0);
}

// Generate the leaderboard
async function main() {
  try {
    console.log(`Generating ${options.type} leaderboard...`);
    console.log(`Verbose mode: ${options.verbose ? 'enabled' : 'disabled'}`);
    
    // Set verbose environment variable
    process.env.VERBOSE = options.verbose ? 'true' : 'false';
    
    let leaderboard;
    
    // Generate the leaderboard based on the type
    switch (options.type) {
      case 'mu':
        leaderboard = await generateAndSaveMuLeaderboard(options.verbose);
        break;
      case 'standard':
        leaderboard = await generateAndSaveStandardLeaderboard(options.verbose);
        break;
      default:
        console.error(`Invalid leaderboard type: ${options.type}`);
        process.exit(1);
    }
    
    // Print the top 5 entries
    console.log('\nTop 5 entries:');
    leaderboard.entries.slice(0, 5).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.twitterHandle || 'Unknown'}: ${entry.totalPoints.toFixed(2)} points`);
    });
    
    console.log('\nLeaderboard generation complete!');
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    process.exit(1);
  }
}

// Run the main function
main();
