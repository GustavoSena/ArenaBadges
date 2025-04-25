// Entry point file that ensures the output directory exists before running the main script
import * as fs from 'fs';
import * as path from 'path';
import { fetchTokenHolderProfiles } from './services/holderService';

// Ensure output directory exists
const outputDir = path.join(__dirname, '../files');
if (!fs.existsSync(outputDir)) {
  console.log(`Creating output directory: ${outputDir}`);
  fs.mkdirSync(outputDir, { recursive: true });
}

// Run the main function only if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  fetchTokenHolderProfiles().catch(console.error);
}
