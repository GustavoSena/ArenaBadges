# MuBadges

A TypeScript application that fetches MUV token holders and Mu Pups NFT holders, retrieves their Twitter handles, and outputs two JSON files:
1. NFT holders with Twitter handles
2. Combined holders (NFT+MUV) with Twitter handles

## Features

- Fetches MUV token holders from Snowtrace API (minimum 100 MUV)
- Fetches Mu Pups NFT holders using ethers.js with Alchemy provider (minimum 1 NFT)
- Retrieves Twitter handles from Arenabook API
- Outputs two separate JSON files with Twitter handles

## Configuration

The application uses a configuration file (`config/tokens.json`) to configure tokens and NFTs. This makes it easy to change parameters without modifying the code.

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
  ]
}
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Snowtrace API key (for token holder data)
- Alchemy API key (for NFT holder data)

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your API keys:
   ```
   SNOWTRACE_API_KEY=your_snowtrace_api_key_here
   ALCHEMY_API_KEY=your_alchemy_api_key_here
   ```
4. Customize the `config.json` file if needed

## Usage

Run the application:

```
npm start
```

This will:
1. Fetch MUV token holders with at least 100 MUV tokens
2. Fetch Mu Pups NFT holders with at least 1 NFT
3. Retrieve Twitter handles for all holders
4. Output two JSON files in the `files` directory:
   - `nft_holders.json`: Twitter handles of NFT holders
   - `combined_holders.json`: Twitter handles of wallets holding both MUV tokens and NFTs

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

The project uses ts-node directly for both start and dev scripts, eliminating the need for a separate build step before running.
