# ArenaBadges

A badge and leaderboard automation system for Arena community tokens and NFTs. This system automatically tracks token holders and NFT owners, assigns badges based on configurable criteria, and generates dynamic leaderboards.

## Features

- **Badge Scheduler**: Automatically collects NFT and token holder data and sends to Arena API endpoints
- **Leaderboard Scheduler**: Generates HTML leaderboards for token holders
- **Multiple Project Support**: Configure and run multiple projects with different tokens and NFTs
- **API Key Rotation**: Supports multiple Moralis API keys with automatic rotation when rate limits are reached
- **Error Handling**: Dynamic rescheduling based on error types for resilient operation
- **Wallet Mapping**: Optional feature to combine NFT holders based on Twitter handles

## Setup

1. Clone the repository
2. Run `npm install`
3. Create a `.env` file with the following variables:

```
MORALIS_API_KEYS=["your-moralis-api-key", "your-backup-moralis-api-key"]
ALCHEMY_API_KEY=your-alchemy-api-key
ARENA_API_KEY=your-arena-api-key
```

## Configuration




Project-specific configurations are stored in the `config/projects/` directory. Each project has its own configuration file (e.g., `boi.json`) with the following structure:

```json
{
  "scheduler": {
    "badgeIntervalHours": 6,
    "badgeRetryIntervalHours": 2,
    "leaderboardIntervalHours": 3,
    "leaderboardRetryIntervalHours": 2
  },
  "walletMappingFile": "wallets.json",
  "enableLeaderboard": true
}
```

Badge configurations are stored in `config/badges/` directory, with files named after the project (e.g., `boi.json`).

Leaderboard configurations are stored in `config/leaderboards/` directory.

## Running

### Badge Scheduler

Run the badge scheduler to automatically fetch token and NFT holder data and send it to the Arena API:

```bash
npm run *projectname*:badges
```

For verbose logging:

```bash
npm run *projectname*:badges:verbose
```

### Leaderboard Scheduler

Run the leaderboard scheduler to automatically generate HTML leaderboards for token holders:

```bash
npm run *projectname*:leaderboard
```

For verbose logging:

```bash
npm run *projectname*:leaderboard:verbose
```

### Running Both Schedulers

To run both the badge and leaderboard schedulers simultaneously:

```bash
npm run *projectname*:run
```

For verbose logging:

```bash
npm run *projectname*:run:verbose
```

## Output

All generated files are saved to the `output/` directory. Logs are stored in the `logs/` directory.

## Advanced Features

### Wallet Mapping

The system supports mapping multiple wallets to a single user via Twitter handles. This allows for aggregating token balances across multiple wallets. Enable this feature by setting `sumOfBalances: true` in the badge configuration.

### Excluded Accounts

Specific Twitter handles can be excluded from leaderboards by adding them to the `excludedAccounts` array in the badge configuration.

### Permanent Badge Accounts

Certain accounts can be configured to always receive badges regardless of token/NFT holdings by adding them to the `permanentAccounts` array in the badge configuration.

### Error Handling

The system automatically detects API rate limits and retry failures, rescheduling runs for a shorter interval (default: 2 hours) instead of the standard interval to recover more quickly from temporary issues.

## Development

### Running Tests

```bash
npm test
```

### One-time Execution Scripts

For running badge or leaderboard generation once without scheduling:

```bash
npm run *projectname*:badge:once
npm run *projectname*:leaderboard:once
```

### Dry Run

```bash
npm run *projectname*:badge:dry-run
```

### Export Addresses

```bash
npm run *projectname*:badge:address
```
