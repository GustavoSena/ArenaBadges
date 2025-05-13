/**
 * Script to run the badge process once for a specific project
 */
import { Command } from 'commander';
import { fetchTokenHolderProfiles } from '../profiles/fetchTokenHolderProfiles';
import { runAndSendResults } from '../services/schedulerService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define command line options
const program = new Command();
program
  .option('-p, --project <project>', 'Project name to run the badge process for')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-d, --dry-run', 'Run in dry-run mode (do not send results to API)')
  .parse(process.argv);

const options = program.opts();
const projectName = options.project;
const verbose = options.verbose || false;
const dryRun = options.dryRun || false;

async function main() {
  try {
    console.log(`Running badge process once for project: ${projectName || 'default'}`);
    console.log(`Verbose mode: ${verbose ? 'enabled' : 'disabled'}`);
    console.log(`Dry run mode: ${dryRun ? 'enabled' : 'disabled'}`);
    
    if (dryRun) {
      // In dry-run mode, just fetch the profiles but don't send to API
      console.log('Dry run mode: Fetching token holder profiles...');
      const results = await fetchTokenHolderProfiles(projectName, verbose);
      console.log(`Fetched ${results.basicHolders.length} basic holders and ${results.upgradedHolders.length} upgraded holders`);
      console.log('Dry run complete. No data was sent to the API.');
    } else {
      // Run the badge process and send results to API
      console.log('Running badge process and sending results to API...');
      // Get API key from environment variable
      const apiKey = process.env.API_KEY;
      await runAndSendResults(apiKey, verbose, false, projectName);
      console.log('Badge process complete. Results sent to API.');
    }
  } catch (error) {
    console.error('Error running badge process:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);
