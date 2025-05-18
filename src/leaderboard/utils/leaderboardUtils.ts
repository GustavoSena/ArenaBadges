import * as fs from 'fs';
import * as path from 'path';

import { Leaderboard } from '../../types/leaderboard';



/**
 * Save the leaderboard to a file
 * @param leaderboard Leaderboard to save
 * @param outputPath Output path
 */
export function saveLeaderboard(leaderboard: Leaderboard, outputPath: string): void {
  try {
    // Ensure the directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save leaderboard to file
    fs.writeFileSync(outputPath, JSON.stringify(leaderboard, null, 2));
    console.log(`Leaderboard saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving leaderboard:', error);
  }
}

