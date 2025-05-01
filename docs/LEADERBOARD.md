# Mu Community Leaderboard Documentation

This document provides detailed information about the Mu Community Leaderboard feature, including how it works, how to configure it, and how to customize it.

## Overview

The Mu Community Leaderboard ranks wallet addresses based on their Mu Pups NFT holdings and token balances (MUV, MUO, MUG, and MU). The leaderboard is designed to be:

- **Efficient**: Only fetches token balances for addresses that have NFTs and social profiles
- **Configurable**: All point weights and settings are in a configuration file
- **Social-focused**: Only includes addresses with Twitter handles
- **Visually appealing**: Generates a responsive HTML leaderboard with profile images and links

## How It Works

The leaderboard generation follows these steps:

1. **Fetch NFT holders**: Gets all Mu Pups NFT holders using the sequential token ID scanning method
2. **Get social profiles**: Fetches Twitter handles for NFT holders from Arenabook
3. **Filter addresses**: Keeps only NFT holders who have Twitter handles
4. **Fetch token balances**: For each token in the config, fetches balances only for these filtered addresses
5. **Apply minimum balances**: For MU tokens, applies dynamic minimum balance requirements based on the current MUG/MU price
6. **Calculate points**: Applies the configured weights to NFT holdings and token balances
7. **Generate leaderboard**: Creates a sorted leaderboard with rankings
8. **Output files**: Saves both JSON and HTML versions of the leaderboard

## MU Leaderboard Specifics

The MU Leaderboard has special features:

### Dynamic Minimum Balances

To ensure holders have a meaningful stake, minimum balances are calculated dynamically:

- **MU**: Minimum 100 tokens
- **MUG**: Minimum equivalent to 100 MU (calculated as 100 ÷ MUG/MU price)
- **MUO**: Minimum equivalent to 100 MU (calculated as 100 ÷ (1.1 × MUG/MU price))
- **MUV**: Minimum equivalent to 100 MU (calculated as 100 ÷ (10 × 1.1 × MUG/MU price))

### Point Calculation

Points are calculated using the following formulas:

- **MU**: 2 × token balance
- **MUG**: 2 × token balance × MUG/MU price
- **MUO**: 1.1 × 2 × token balance × MUG/MU price
- **MUV**: 10 × 1.1 × 2 × token balance × MUG/MU price
- **Mu Pups NFTs**: 10 × 2 × NFT count × MUG/MU price

### HTML Output Features

The leaderboard HTML includes:

- **Branded Header**: Project logo and title with gradient hover effect
- **Profile Images**: Twitter profile images displayed at a fixed size (40×40px)
- **Arena Profile Button**: Pill-shaped button linking to the holder's Arena profile
- **Gradient Styling**: Header bar with gradient background, footer with gradient text
- **Responsive Layout**: Centered table with max-width for better readability
- **Pagination**: Gradient-styled pagination controls for large leaderboards
- **Timestamp**: Shows when the leaderboard was last updated

## Configuration

The leaderboard is configured through the `config/leaderboard.json` file:

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

### Configuration Options

#### Token Weights

Each token has the following properties:

- `address`: The contract address of the token
- `symbol`: The token symbol (used in the leaderboard display)
- `pointsPerToken`: How many points each token is worth (can be a decimal)

#### NFT Weights

Each NFT has the following properties:

- `address`: The contract address of the NFT
- `name`: The name of the NFT collection (used in the leaderboard display)
- `pointsPerNft`: How many points each NFT is worth
- `minBalance`: The minimum number of NFTs a holder must have to be included

#### Output Settings

- `filename`: The base filename for the output files (both JSON and HTML)
- `maxEntries`: Maximum number of entries to include in the leaderboard

## Running the Leaderboard

To generate the leaderboard:

```bash
npm run leaderboard
```

This will:
1. Create a JSON file at `files/leaderboard.json`
2. Create an HTML file at `files/leaderboard.html`

## HTML Output

The HTML leaderboard includes:

- **Profile Images**: Twitter profile images from Arenabook (with fallback avatar)
- **Arena Profile Links**: Each Twitter handle links to its Arena profile (`https://arena.social/username`)
- **Snowtrace Links**: Each wallet address links to its Snowtrace page
- **Points Breakdown**: Total points and breakdown by token/NFT
- **Responsive Design**: Works well on both desktop and mobile devices

## Customizing the HTML Output

The HTML output is generated in `src/utils/htmlGenerator.ts`. You can modify this file to change the appearance of the leaderboard.

Key aspects you might want to customize:

- **CSS Styles**: Change colors, fonts, spacing, etc.
- **Column Layout**: Add or remove columns
- **Information Display**: Change what information is shown for each holder
- **Links**: Modify the links to point to different services

## Adding New Tokens or NFTs

To add a new token or NFT to the leaderboard:

1. Add it to the `config/leaderboard.json` file with appropriate weights
2. Regenerate the leaderboard

No code changes are required to add new tokens or NFTs.

## Technical Implementation

The leaderboard is implemented with the following components:

- `src/generateLeaderboard.ts`: Entry point script
- `src/services/leaderboardService.ts`: Core leaderboard generation logic
- `src/utils/htmlGenerator.ts`: HTML output generation
- `src/types/leaderboard.ts`: TypeScript interfaces for the leaderboard

The implementation uses ethers.js with an Alchemy provider to fetch blockchain data directly, making it more efficient and reliable than using third-party APIs.

## Troubleshooting

### Common Issues

- **Missing API Keys**: Ensure your `.env` file has the required API keys
- **Rate Limiting**: If you hit rate limits, try increasing the delay between API calls
- **Network Issues**: Check your connection to Alchemy and other services
- **Missing Social Profiles**: Ensure the addresses you're checking have Twitter handles in Arenabook

### Logging

The leaderboard generation includes detailed logging to help troubleshoot issues:

- NFT holder fetching progress
- Social profile fetching progress
- Token balance fetching progress
- Final counts and statistics

Check the console output for any error messages or warnings.

## Future Enhancements

Potential future enhancements for the leaderboard:

- **Automatic Scheduling**: Generate the leaderboard on a regular schedule
- **Historical Data**: Track changes in rankings over time
- **Additional Metrics**: Include more data points like transaction activity
- **Interactive Features**: Add sorting, filtering, and search to the HTML output
- **API Integration**: Provide the leaderboard data through an API endpoint
