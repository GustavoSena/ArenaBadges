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
- **Robust Moralis API Key Rotation**: Automatically rotates between multiple API keys when quota limits are reached
- **Extensible Leaderboard System**: Class-based architecture allowing for custom point calculation logic
- **Standalone Leaderboard Server**: Continuously serves the leaderboard HTML with automatic and manual refresh options

## Leaderboard Features

### Standard Leaderboard

The standard leaderboard system ranks wallets based on their Mu Pups NFT and token holdings. Key features include:

- **Configurable Weights**: Each token and NFT has configurable point weights
- **Social Profile Integration**: Only includes addresses with Twitter handles
- **Optimized Data Fetching**: First fetches NFT holders, filters for those with social profiles, then selectively queries token balances
- **Rich HTML Output**: Includes Twitter profile images, Arena profile links, and Snowtrace wallet links
- **Fully Configurable**: All settings are in `config/leaderboard.json`

### Class-Based Leaderboard System

The project now includes a class-based leaderboard system that allows for flexible and extensible point calculation logic:

- **Base Leaderboard Class**: Abstract class defining the common structure and functionality
- **Custom Implementations**: Specific implementations with different point calculation rules
- **MU Leaderboard**: Implementation with dynamic point values based on contract-provided prices

### MU Leaderboard Point Calculation

The MU Leaderboard uses the following point calculation rules:

- **MU Tokens**: 2 points per token
- **MUG Tokens**: 2 points per token multiplied by the MUG/MU price (retrieved from contract)
- **MUO Tokens**: 1.1 × 2 points per token multiplied by the MUG/MU price
- **MUV Tokens**: 10 × 1.1 × 2 points per token multiplied by the MUG/MU price
- **Mu Pups NFTs**: 10 × 2 points per NFT multiplied by the MUG/MU price

### Dynamic Minimum Balance Requirements

The MU Leaderboard implements dynamic minimum balance requirements to ensure holders have a meaningful stake:

- **MU**: Minimum 100 tokens
- **MUG**: Minimum equivalent to 100 MU (calculated as 100 ÷ MUG/MU price)
- **MUO**: Minimum equivalent to 100 MU (calculated as 100 ÷ (1.1 × MUG/MU price))
- **MUV**: Minimum equivalent to 100 MU (calculated as 100 ÷ (10 × 1.1 × MUG/MU price))

### HTML Output Enhancements

The leaderboard HTML output includes the following features:

- **Branded Header**: Project-specific logo, title, and gradient colors
- **Profile Images**: Twitter profile images displayed at a fixed size (40×40px)
- **Arena Profile Button**: Pill-shaped button linking to the holder's Arena profile
- **Gradient Styling**: Header bar with gradient background, footer with gradient text
- **Responsive Layout**: Centered table with max-width for better readability
- **Pagination**: Gradient-styled pagination controls for large leaderboards

## Leaderboard Server

The project includes a robust standalone leaderboard server that continuously serves the leaderboard HTML and refreshes data automatically. See [LEADERBOARD_SERVER.md](LEADERBOARD_SERVER.md) for detailed documentation.

### Key Server Features

- **Continuous Availability**: The leaderboard HTML is always accessible, even during data refreshes
- **Automatic Refresh**: Leaderboard data refreshes automatically every 3 hours
- **Manual Refresh**: Supports forced refreshes via a dedicated script
- **Worker Process**: All refresh operations run in separate processes for reliability
- **Multiple Leaderboard Types**: Supports both MU and Standard leaderboards
- **Cloud-Ready**: Configured for deployment to AWS or other cloud providers

### Running the Server

Start the leaderboard server:
```bash
npm run leaderboard-server
```

The server will start on port 3001 (or the port specified in your environment variables).

### Manual Refresh

To manually trigger a refresh:
```bash
npm run refresh-leaderboard
```

## Project Structure

The project is now organized into a clear, modular structure with separate directories for leaderboard and badge functionality:

- `src/index.ts`: Main entry point that starts both leaderboard and badge servers
- `src/leaderboard/`: All leaderboard-related functionality
  - `server/`: Leaderboard server implementation
    - `leaderboardSchedulerServer.ts`: Express server for serving leaderboards
    - `refreshLeaderboard.ts`: Script for manually triggering leaderboard refresh
  - `services/`: Core leaderboard services
    - `leaderboardClassService.ts`: Class-based leaderboard generation
    - `leaderboardService.ts`: Standard leaderboard generation
  - `generators/`: Leaderboard generation scripts
    - `generateCustomLeaderboard.ts`: Script for generating custom leaderboards (MU or standard)
    - `generateLeaderboard.ts`: Script for generating the standard leaderboard
    - `generateMuLeaderboard.ts`: Script for generating the MU leaderboard
- `src/badges/`: All badge-related functionality
  - `server/`: Badge server implementation
    - `badgeSchedulerServer.ts`: Express server for badge scheduling
  - `services/`: Core badge services
    - `schedulerService.ts`: Manages the scheduling of data collection and API updates
    - `holderService.ts`: Fetches token and NFT holders
    - `apiService.ts`: Handles API communication
  - `profiles/`: Profile management
    - `fetchTokenHolderProfiles.ts`: Fetches token holder profiles
    - `holderProfileManager.ts`: Manages fetching and saving holder profiles
    - `sendResults.ts`: Script for sending results to the API
  - `utils/`: Badge-specific utilities
    - `helpers.ts`: Helper functions for badge functionality
  - `config/`: Badge-specific configuration
- `src/api/`: API integrations
  - `blockchain.ts`: Fetches NFT holders using ethers.js
  - `moralis.ts`: Fetches token holders with API key rotation
  - `snowtrace.ts`: Fetches token holders from Snowtrace
  - `arenabook.ts`: Fetches social profiles from Arenabook
- `src/utils/`: Common utility functions
  - `htmlGenerator.ts`: Generates HTML output for the leaderboard
  - `helpers.ts`: Common helper functions
- `src/types/`: TypeScript interfaces and types
  - `interfaces.ts`: Common interfaces for the application
  - `leaderboard.ts`: Interfaces for the leaderboard feature
  - `leaderboardClasses.ts`: Class-based leaderboard system
- `docs/`: Documentation
- `config/`: Global configuration files
- `public/`: Public HTML files served by the leaderboard server
- `assets/`: Static assets like logos
- `tests/`: Test files

## Running the Servers

### Start Both Servers

To start both the leaderboard and badge servers:

```bash
npm start
```

### Start Leaderboard Server Only

To start only the leaderboard server:

```bash
npm run leaderboard-server
```

### Start Badge Server Only

To start only the badge server:

```bash
npm run badge-server
```

### Refresh Leaderboard Manually

To manually trigger a leaderboard refresh:

```bash
npm run refresh-leaderboard
```

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
- Moralis API key(s) (for token holder data)

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
   MORALIS_API_KEYS=["key1", "key2", "key3"]
   ```
   
   **Note**: For Moralis API keys, you can specify multiple keys in a JSON array format as shown above. The system will automatically rotate between these keys if one reaches its quota limit. For backward compatibility, you can also use a single key with `MORALIS_API_KEY=your_key`.

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

### Generate Standard Leaderboard

To generate the standard community leaderboard:

```
npm run leaderboard
```

### Generate MU Leaderboard

To generate the MU leaderboard with dynamic point calculation:

```
npm run mu-leaderboard
```

Both leaderboard commands will create JSON and HTML versions of the leaderboard in the `files/` directory.

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
