/**
 * Configuration Migration Script
 * 
 * This script migrates the old configuration files to the new consolidated structure.
 * It reads all existing config files and generates the new consolidated files.
 */

const fs = require('fs');
const path = require('path');

// Paths to configuration files
const CONFIG_DIR = path.join(process.cwd(), 'config');
const TOKENS_PATH = path.join(CONFIG_DIR, 'tokens.json');
const BADGES_PATH = path.join(CONFIG_DIR, 'badges.json');
const EXCLUDED_ACCOUNTS_PATH = path.join(CONFIG_DIR, 'excluded_accounts.json');
const SCHEDULER_PATH = path.join(CONFIG_DIR, 'scheduler.json');
const LEADERBOARD_PATH = path.join(CONFIG_DIR, 'leaderboard.json');
const MU_LEADERBOARD_PATH = path.join(CONFIG_DIR, 'mu_leaderboard.json');

// Paths to new configuration files
const NEW_CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const LEADERBOARDS_DIR = path.join(CONFIG_DIR, 'leaderboards');
const PROJECTS_DIR = path.join(CONFIG_DIR, 'projects');
const STANDARD_LEADERBOARD_PATH = path.join(LEADERBOARDS_DIR, 'standard.json');
const MU_NEW_LEADERBOARD_PATH = path.join(LEADERBOARDS_DIR, 'mu.json');
const ARENA_PROJECT_PATH = path.join(PROJECTS_DIR, 'arena.json');

// Create directories if they don't exist
if (!fs.existsSync(LEADERBOARDS_DIR)) {
  fs.mkdirSync(LEADERBOARDS_DIR, { recursive: true });
  console.log(`Created directory: ${LEADERBOARDS_DIR}`);
}

if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  console.log(`Created directory: ${PROJECTS_DIR}`);
}

// Read existing configuration files
function readJsonFile(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}

// Load existing configurations
const tokensConfig = readJsonFile(TOKENS_PATH);
const badgesConfig = readJsonFile(BADGES_PATH);
const excludedAccountsConfig = readJsonFile(EXCLUDED_ACCOUNTS_PATH);
const schedulerConfig = readJsonFile(SCHEDULER_PATH);
const leaderboardConfig = readJsonFile(LEADERBOARD_PATH);
const muLeaderboardConfig = readJsonFile(MU_LEADERBOARD_PATH);

// Create arena project configuration
const arenaProjectConfig = {
  projectName: "ArenaBadges",
  tokens: tokensConfig.tokens || [],
  nfts: tokensConfig.nfts || [],
  scheduler: {
    badgeIntervalHours: tokensConfig.scheduler?.intervalHours || 
                         badgesConfig.scheduler?.intervalHours || 
                         schedulerConfig.intervals?.badge || 6,
    enableLeaderboard: tokensConfig.scheduler?.enableLeaderboard !== undefined ?
                       tokensConfig.scheduler.enableLeaderboard : true,
    leaderboardIntervalHours: tokensConfig.scheduler?.leaderboardIntervalHours || 
                              schedulerConfig.intervals?.leaderboard || 3,
    leaderboardTypes: tokensConfig.scheduler?.leaderboardTypes || ["standard", "mu"]
  },
  api: tokensConfig.api || {
    baseUrl: "http://api.arena.social/badges",
    endpoints: {
      nftOnly: "mu-tier-1",
      combined: "mu-tier-2"
    },
    includeCombinedInNft: true
  },
  excludedAccounts: excludedAccountsConfig.excludedAccounts || []
};

// Create main configuration that points to the arena project
const newConfig = {
  activeProject: "arena",
  projectName: "ArenaBadges"
};

// Write the new configuration files
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully wrote ${filePath}`);
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

// Write main config
writeJsonFile(NEW_CONFIG_PATH, newConfig);

// Write arena project config
writeJsonFile(ARENA_PROJECT_PATH, arenaProjectConfig);

// Write standard leaderboard config
writeJsonFile(STANDARD_LEADERBOARD_PATH, leaderboardConfig);

// Write MU leaderboard config
writeJsonFile(MU_NEW_LEADERBOARD_PATH, muLeaderboardConfig);

console.log('\nConfiguration migration completed successfully!');
console.log('\nThe following new configuration files have been created:');
console.log(`- ${NEW_CONFIG_PATH}`);
console.log(`- ${ARENA_PROJECT_PATH}`);
console.log(`- ${STANDARD_LEADERBOARD_PATH}`);
console.log(`- ${MU_NEW_LEADERBOARD_PATH}`);

console.log('\nThe old configuration files have been preserved. Once you verify that the new configuration works correctly, you can remove the old files if desired.');
console.log('\nTo use the new configuration, update your code to import from the new config module:');
console.log('import { loadAppConfig, loadLeaderboardConfig } from \'../utils/config\';');
