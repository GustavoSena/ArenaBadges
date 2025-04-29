# MuBadges

A TypeScript application that fetches MUV, MUO, MUG, and MU token holders and Mu Pups NFT holders, retrieves their Twitter handles, and provides the following features:
1. NFT holders with Twitter handles
2. Combined holders (NFT+Tokens) with Twitter handles
3. Community leaderboard based on token and NFT holdings

## Features

- Fetches token holders from Avalanche blockchain using Alchemy provider
- Fetches Mu Pups NFT holders using ethers.js with Alchemy provider (minimum 1 NFT)
- Retrieves Twitter handles and profile images from Arenabook API
- Outputs JSON files with Twitter handles
- Generates a beautiful HTML leaderboard with Twitter profile images and links
- Runs on a configurable schedule
- Only sends updates to the Arena Social Badges API if there are changes since the last run
- Modular architecture with separation of concerns

## New Leaderboard Feature

The leaderboard system ranks wallets based on their Mu Pups NFT and token holdings. Key features include:

- **Configurable Weights**: Each token and NFT has configurable point weights
- **Social Profile Integration**: Only includes addresses with Twitter handles
- **Optimized Data Fetching**: First fetches NFT holders, filters for those with social profiles, then selectively queries token balances
- **Rich HTML Output**: Includes Twitter profile images, Arena profile links, and Snowtrace wallet links
- **Fully Configurable**: All settings are in `config/leaderboard.json`

## Configuration

### Token and NFT Configuration

The application uses a configuration file (`config/tokens.json`) to configure tokens, NFTs, scheduler settings, and API endpoints. This makes it easy to change parameters without modifying the code.

Example configuration:
```json
{
  "tokens": [
    {
      "address": "0xdbA664085ae73CF4E4eb57954BDC88Be297B1f09",
      "symbol": "MUV",
      "decimals": 18,
      "minBalance": 100
    }
  ],
  "nfts": [
    {
      "address": "0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0",
      "name": "Mu Pups",
      "minBalance": 1
    }
  ],
  "scheduler": {
    "intervalHours": 6
  },
  "api": {
    "baseUrl": "http://api.arena.social/badges",
    "endpoints": {
      "nftOnly": "mu-tier-1",
      "combined": "mu-tier-2"
    }
  }
}
```

### Leaderboard Configuration

The leaderboard uses a separate configuration file (`config/leaderboard.json`) to define token and NFT weights, minimum balances, and output settings:

```json
{
  "weights": {
    "tokens": [
      {
        "address": "0xdbA664085ae73CF4E4eb57954BDC88Be297B1f09",
        "symbol": "MUV",
        "pointsPerToken": 1
      },
      {
        "address": "0x57Eb0aaAf69E22D8adAe897535bF57c7958e0f3c",
        "symbol": "MUO",
        "pointsPerToken": 1
      },
      {
        "address": "0x4b6aDF3dC4D45E2Ec6c5d49e24e7f0BE6b87B25d",
        "symbol": "MUG",
        "pointsPerToken": 1
      },
      {
        "address": "0x4b6aDF3dC4D45E2Ec6c5d49e24e7f0BE6b87B25d",
        "symbol": "MU",
        "pointsPerToken": 1
      }
    ],
    "nfts": [
      {
        "address": "0x34a0a23aa79cdee7014e4c9afaf20bcce22749c0",
        "name": "Mu Pups",
        "pointsPerNft": 100,
        "minBalance": 1
      }
    ]
  },
  "output": {
    "filename": "leaderboard.json",
    "maxEntries": 100
  }
}
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Alchemy API key (for blockchain data)
- Arena Social Badges API key (for sending badge updates)

## Installation

1. Clone the repository
   ```
   git clone https://github.com/GustavoSena/ArenaBadges.git
   cd ArenaBadges
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your API keys:
   ```
   ALCHEMY_API_KEY=your_alchemy_api_key_here
   API_KEY=your_arena_social_badges_api_key_here
   ```
4. Customize the configuration files in the `config/` directory if needed

## Usage

### Run the Application with Scheduler

Run the application with the scheduler to automatically fetch and update badge data at the configured interval:

```
npm start
```

### Fetch Profiles Only

To only fetch holder profiles and save them to files without sending to the API:

```
npm run fetch-profiles
```

### Send Results to API

To fetch profiles and send them to the API (only if changed since last run):

```
npm run send-results
```

### Generate Leaderboard

To generate the community leaderboard:

```
npm run leaderboard
```

This will create both JSON and HTML versions of the leaderboard in the `files/` directory.

## Project Structure

- `src/index.ts`: Main entry point that starts the scheduler
- `src/holderProfileManager.ts`: Manages fetching and saving holder profiles
- `src/sendResults.ts`: Script for sending results to the API
- `src/generateLeaderboard.ts`: Script for generating the community leaderboard
- `src/services/`: Core services for the application
  - `holderService.ts`: Fetches token and NFT holders
  - `leaderboardService.ts`: Calculates points and generates leaderboard
  - `socialProfiles.ts`: Processes holders and fetches their social profiles
  - `apiService.ts`: Handles API communication
  - `schedulerService.ts`: Manages the scheduling of data collection and API updates
- `src/api/`: API integrations
  - `blockchain.ts`: Fetches NFT holders using ethers.js
  - `snowtrace.ts`: Fetches token holders from Snowtrace
  - `arenabook.ts`: Fetches social profiles from Arenabook
- `src/utils/`: Utility functions
  - `htmlGenerator.ts`: Generates HTML output for the leaderboard
  - `helpers.ts`: Common helper functions
- `src/types/`: TypeScript interfaces and types
- `config/`: Configuration files
- `files/`: Output directory for JSON and HTML files
- `tests/`: Test files

## Output Format

### Badge Files

Badge output files follow this format:

```json
{
  "handles": [
    "twitter_handle_1",
    "twitter_handle_2",
    ...
  ]
}
```

### Leaderboard

The leaderboard JSON file follows this format:

```json
{
  "timestamp": "2025-04-29T10:30:00.000Z",
  "entries": [
    {
      "rank": 1,
      "twitterHandle": "user1",
      "profileImageUrl": "https://pbs.twimg.com/profile_images/...",
      "address": "0x123...",
      "totalPoints": 1500,
      "tokenPoints": {
        "MUV": 500,
        "MUO": 300
      },
      "nftPoints": {
        "Mu Pups": 700
      }
    },
    ...
  ]
}
```

## Development

For development with automatic restarts:

```
npm run dev
```

Run tests:

```
npm test
```

The project uses ts-node directly for all scripts, eliminating the need for a separate build step before running.
