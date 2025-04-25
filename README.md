# MuBadges

A TypeScript application that fetches MUV token holders and Mu Pups NFT holders, retrieves their Twitter handles, and outputs two JSON files:
1. NFT holders with Twitter handles
2. Combined holders (NFT+MUV) with Twitter handles

## Features

- Fetches MUV token holders from Snowtrace API (minimum 100 MUV)
- Fetches Mu Pups NFT holders using ethers.js with Alchemy provider (minimum 1 NFT)
- Retrieves Twitter handles from Arenabook API
- Outputs two separate JSON files with Twitter handles
- Runs on a configurable schedule
- Only sends updates to the Arena Social Badges API if there are changes since the last run
- Modular architecture with separation of concerns

## Configuration

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

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Alchemy API key (for NFT holder data)
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
4. Customize the `config/tokens.json` file if needed

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

## Project Structure

- `src/index.ts`: Main entry point that starts the scheduler
- `src/holderProfileManager.ts`: Manages fetching and saving holder profiles
- `src/sendResults.ts`: Script for sending results to the API
- `src/services/`: Core services for the application
  - `holderService.ts`: Fetches token and NFT holders
  - `socialProfiles.ts`: Processes holders and fetches their social profiles
  - `apiService.ts`: Handles API communication
  - `schedulerService.ts`: Manages the scheduling of data collection and API updates
- `src/utils/`: Utility functions
- `config/`: Configuration files
- `files/`: Output directory for JSON files

## Output Format

Both output files follow the same format:

```json
{
  "handles": [
    "twitter_handle_1",
    "twitter_handle_2",
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
