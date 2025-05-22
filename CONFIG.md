# Configuration System

This document describes the new configuration system for the ArenaBadges project. The configuration has been consolidated to make it more maintainable and fully project-agnostic, allowing you to easily switch between different project configurations.

## Configuration Files

The configuration is now organized into the following directory structure:

```
config/
├── config.json                # Main configuration file (points to active project)
├── projects/                  # Project-specific configurations
│   ├── arena.json            # Arena project configuration
│   └── badges-only.json      # Example project with badges only (no leaderboards)
└── leaderboards/             # Leaderboard-specific configurations
    ├── standard.json         # Standard leaderboard configuration
    └── mu.json               # MU-specific leaderboard configuration
```

### Main Configuration (`config/config.json`)

This file now serves as a pointer to the active project configuration. It's a lightweight file that simply specifies which project configuration to use:

```json
{
  "activeProject": "arena",
  "projectName": "ArenaBadges"
}
```

The `activeProject` field specifies which project configuration to load from the `config/projects/` directory. In this case, it will load the `arena.json` file.

### Project-Specific Configurations (`config/projects/*.json`)

Each project has its own complete configuration file in the `config/projects/` directory. These files contain all the settings specific to a particular project:

```json
{
  "projectName": "ArenaBadges",
  "tokens": [
    {
      "symbol": "MUV",
      "address": "0xdbA664085ae73CF4E4eb57954BDC88Be297B1f09",
      "minBalance": 100,
      "decimals": 18
    }
  ],
  "nfts": [
    {
      "name": "Mu Pups",
      "address": "0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0",
      "collectionSize": 350,
      "minBalance": 1
    }
  ],
  "scheduler": {
    "badgeIntervalHours": 6,
    "enableLeaderboard": true,
    "leaderboardIntervalHours": 3,
    "leaderboardTypes": ["standard", "mu"]
  },
  "api": {
    "baseUrl": "http://api.arena.social/badges",
    "endpoints": {
      "nftOnly": "mu-tier-1",
      "combined": "mu-tier-2"
    },
    "includeCombinedInNft": true
  },
  "excludedAccounts": [
    "mucoinofficial"
  ]
}
```

### Leaderboard Configurations (`config/leaderboards/*.json`)

Each leaderboard type has its own configuration file in the `config/leaderboards` directory:

#### Standard Leaderboard (`config/leaderboards/standard.json`)

```json
{
  "weights": {
    "tokens": [
      {
        "symbol": "MUV",
        "address": "0xdbA664085ae73CF4E4eb57954BDC88Be297B1f09",
        "pointsPerToken": 15,
        "minBalance": 10,
        "decimals": 18
      }
    ],
    "nfts": [
      {
        "name": "Mu Pups",
        "address": "0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0",
        "pointsPerNft": 200,
        "minBalance": 1
      }
    ]
  },
  "output": {
    "maxEntries": 0,
    "fileName": "leaderboard.json",
    "title": "Arena Badges Leaderboard",
    "logoPath": "assets/arena_logo.png",
    "primaryColor": "#3498db",
    "secondaryColor": "#e0e0e0",
    "accentColor": "#2c3e50",
    "backgroundColor": "#f5f5f5"
  }
}
```

#### Project-Specific Leaderboard (e.g., `config/leaderboards/mu.json`)

```json
{
  "weights": {
    "tokens": [
      {
        "symbol": "MUV",
        "address": "0xdbA664085ae73CF4E4eb57954BDC88Be297B1f09",
        "pointsPerToken": 15,
        "minBalance": 0,
        "decimals": 18,
        "description": "Minimum balance calculated dynamically"
      }
    ],
    "nfts": [
      {
        "name": "Mu Pups",
        "address": "0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0",
        "pointsPerNft": 200,
        "minBalance": 1
      }
    ]
  },
  "output": {
    "maxEntries": 0,
    "fileName": "mu_leaderboard.json",
    "title": "MU Community Leaderboard",
    "logoPath": "mu_logo.png",
    "titleLink": "https://www.mu.money/",
    "primaryColor": "#ff00ff",
    "secondaryColor": "#e0e0e0",
    "accentColor": "#3498db",
    "backgroundColor": "#f5f5f5",
    "gradientStart": "#ff00ff",
    "gradientEnd": "#9900ff"
  }
}
```

## Using the Configuration System

The configuration system provides a unified API for accessing configuration values:

```typescript
import { loadAppConfig, loadLeaderboardConfig } from '../utils/config';

// Load the active project's configuration (automatically determined from config.json)
const appConfig = loadAppConfig();

// Or load a specific project's configuration by name
const badgesOnlyConfig = loadAppConfig('badges-only');

// Access configuration values
const projectName = appConfig.projectName;
const tokens = appConfig.tokens;
const nfts = appConfig.nfts;
const badgeIntervalHours = appConfig.scheduler.badgeIntervalHours;
const enableLeaderboard = appConfig.scheduler.enableLeaderboard;
const leaderboardIntervalHours = appConfig.scheduler.leaderboardIntervalHours;
const leaderboardTypes = appConfig.scheduler.leaderboardTypes;
const apiBaseUrl = appConfig.api.baseUrl;
const apiEndpoints = appConfig.api.endpoints;
const excludedAccounts = appConfig.excludedAccounts;

// Load a specific leaderboard config
const standardLeaderboardConfig = loadLeaderboardConfig('standard');
const muLeaderboardConfig = loadLeaderboardConfig('mu');

// Access leaderboard configuration values
const tokenWeights = standardLeaderboardConfig.weights.tokens;
const nftWeights = standardLeaderboardConfig.weights.nfts;
const outputSettings = standardLeaderboardConfig.output;
```

## Project Configuration Options

### Adding a New Project

To add a new project to the system:

1. Create a new project configuration file in the `config/projects` directory (e.g., `config/projects/newproject.json`).
2. If the project needs custom leaderboards, create the corresponding leaderboard configuration files in the `config/leaderboards` directory.
3. Update the `config/config.json` file to set the `activeProject` field to your new project's name.

Example of adding a new project:

```bash
# 1. Create the project configuration file
cp config/projects/arena.json config/projects/newproject.json
# Edit the new file to customize it for your project

# 2. Create any needed leaderboard configurations
cp config/leaderboards/standard.json config/leaderboards/newproject.json
# Edit the new leaderboard configuration as needed

# 3. Update the main config to use the new project
echo '{"activeProject": "newproject", "projectName": "New Project"}' > config/config.json
```

### Adding a New Leaderboard Type

To add a new leaderboard type to an existing project:

1. Create a new leaderboard configuration file in the `config/leaderboards` directory (e.g., `config/leaderboards/newtype.json`).
2. Add the new leaderboard type to the `leaderboardTypes` array in the project's configuration file.
3. Create a new leaderboard implementation class that extends `BaseLeaderboard` and implements the required methods.

### Configuring a Project with Badges Only (No Leaderboards)

If you want to configure a project that only uses badges and doesn't need leaderboards, you can:

1. Set `enableLeaderboard` to `false` in the scheduler configuration:

```json
"scheduler": {
  "badgeIntervalHours": 6,
  "enableLeaderboard": false,
  "leaderboardIntervalHours": 3,
  "leaderboardTypes": []
}
```

This will:
- Continue to run the badge scheduler to collect and send badge data to the API
- Completely disable the leaderboard scheduler
- Prevent any leaderboard generation

Alternatively, if you want to keep the leaderboard system enabled but not generate any leaderboards for a specific project, you can set `leaderboardTypes` to an empty array:

```json
"scheduler": {
  "badgeIntervalHours": 6,
  "enableLeaderboard": true,
  "leaderboardIntervalHours": 3,
  "leaderboardTypes": []
}
```

This approach is useful if you want to temporarily disable leaderboards but might enable them in the future.

## Migration

A migration script is provided to help migrate from the old configuration structure to the new one:

```bash
npm run migrate-config
```

This script reads the old configuration files and generates the new consolidated files. The old configuration files are preserved, so you can verify that the new configuration works correctly before removing the old files.
