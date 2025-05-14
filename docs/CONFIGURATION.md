# MuBadges Configuration System

## Overview

The MuBadges project uses a project-specific configuration system that allows for managing multiple projects while maintaining backward compatibility with existing code. This document explains the structure and usage of this configuration system.

## Configuration Structure

The configuration files are organized as follows:

```
config/
├── config.json             # Main configuration file with active project pointer
├── badges/                 # Badge-specific configurations
│   └── mu.json             # MU badge configuration
├── leaderboards/          
│   ├── mu.json             # MU leaderboard configuration
│   └── standard.json       # Standard leaderboard configuration
└── projects/
    ├── arena.json          # Arena project configuration
    └── badges-only.json    # Badges-only project configuration
```

### Main Configuration File

The `config.json` file contains a pointer to the active project:

```json
{
  "activeProject": "arena"
}
```

### Badge Configuration Files

Badge configurations are stored in the `config/badges/` directory. Each file contains the configuration for a specific badge type, including:

- Name and description
- NFT configuration
- Token configurations
- Permanent accounts (Twitter handles that should always be included in badge holder lists)

Example badge configuration (`mu.json`):

```json
{
  "name": "Mu Pups Badge",
  "description": "Badge configuration for Mu Pups NFT holders",
  "nft": {
    "name": "Mu Pups",
    "address": "0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0",
    "collectionSize": 350
  },
  "tokens": [
    {
      "symbol": "MUV",
      "address": "0xdbA664085ae73CF4E4eb57954BDC88Be297B1f09",
      "minBalance": 100,
      "decimals": 18
    }
  ],
  "permanentAccounts": [
    "mucoinofficial",
    "ceojonvaughn",
    "aunkitanandi"
  ]
}
```

### Project Configuration Files

Each project has its own configuration file in the `config/projects/` directory. These files contain the base settings for a specific project, including:

- Project name
- Tokens configuration
- NFTs configuration
- Scheduler settings
- API endpoints
- Excluded accounts (for leaderboards)
- Permanent accounts (for badges)

The project configuration serves as the base configuration that is loaded when the application starts. The badge-specific and leaderboard-specific configurations provide additional settings for their respective features.

Example project configuration (`arena.json`):

```json
{
  "projectName": "Arena",
  "tokens": [
    {
      "symbol": "MUV",
      "address": "0x...",
      "minBalance": 100,
      "decimals": 18
    }
  ],
  "nfts": [
    {
      "name": "Mu Pups",
      "address": "0x...",
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
  "excludedAccounts": ["mucoinofficial"]
}
```

### Leaderboard Configuration Files

Leaderboard configurations are stored in the `config/leaderboards/` directory. Each file contains the configuration for a specific leaderboard type, including:

- Title and description
- Token weights
- NFT weights
- Output settings
- Excluded accounts (Twitter handles to exclude from the leaderboard)

Example leaderboard configuration (`mu.json`):

```json
{
  "title": "MU Leaderboard",
  "description": "Leaderboard for MU token holders",
  "weights": {
    "tokens": [
      {
        "symbol": "MUV",
        "weight": 1,
        "minBalance": 100,
        "address": "0xdbA664085ae73CF4E4eb57954BDC88Be297B1f09",
        "decimals": 18
      }
    ],
    "nfts": [
      {
        "name": "Mu Pups",
        "weight": 10,
        "address": "0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0"
      }
    ]
  },
  "output": {
    "title": "MU Leaderboard",
    "logoPath": "mu-logo.png",
    "cssPath": "mu-style.css",
    "templatePath": "mu-template.html",
    "outputPath": "mu-leaderboard.html"
  },
  "excludedAccounts": ["mucoinofficial"]
}
```

## Using the Configuration System

### Loading Configuration

The configuration system is accessed through utility functions in the codebase:

```typescript
// Load the active project configuration
import { loadAppConfig } from './utils/config';
const appConfig = loadAppConfig();

// Load a specific project configuration
const projectConfig = loadAppConfig('badges-only');

// Load a specific leaderboard configuration
import { loadLeaderboardConfig } from './utils/config';
const leaderboardConfig = loadLeaderboardConfig('mu');
```

### Adding a New Project

To add a new project:

1. Create a new JSON file in the `config/projects/` directory (e.g., `new-project.json`)
2. Copy the structure from an existing project configuration
3. Update the values as needed
4. Update `config.json` to point to the new project if you want to make it active

### Adding a New Leaderboard Type

To add a new leaderboard type:

1. Create a new JSON file in the `config/leaderboards/` directory (e.g., `new-type.json`)
2. Copy the structure from an existing leaderboard configuration
3. Update the values as needed
4. Add the new type to the `leaderboardTypes` array in the project configuration

## Legacy Configuration Support

The system maintains backward compatibility with legacy code that expects the old configuration structure. The `loadTokensConfig()` function in `src/badges/utils/helpers.ts` converts the new project-specific configuration to the legacy format expected by older parts of the codebase.

## Excluded Accounts

The system supports excluding specific accounts from leaderboards. These accounts are defined in the project configuration's `excludedAccounts` array. The accounts are excluded during leaderboard generation by the `BaseLeaderboard` class.
