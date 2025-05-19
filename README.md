# ArenaBadges

A badge automation system for Arena community tokens and NFTs. This system automatically tracks token holders and NFT owners and assigns badges based on configurable criteria.

## Features

- **Badge Scheduler**: Automatically collects NFT and token holder data and sends to Arena API endpoints
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
    "badgeRetryIntervalHours": 2
  },
  "walletMappingFile": "wallets.json"
}
```

Badge configurations are stored in `config/badges/` directory, with files named after the project (e.g., `boi.json`).

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



### Running the Badge Scheduler

```bash
npm run *projectname*:run
```

For verbose logging:

```bash
npm run *projectname*:run:verbose
```

## Output

All badge data is saved to the `output/badges/` directory. Logs are stored in the `logs/` directory.

## Advanced Features

### Wallet Mapping

The system supports mapping multiple wallets to a single user via Twitter handles. This allows for aggregating token balances across multiple wallets. Enable this feature by setting `sumOfBalances: true` in the badge configuration.

### Excluded Accounts

Specific Twitter handles can be excluded from badge assignments by adding them to the `excludedAccounts` array in the badge configuration.

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

For running badge generation once without scheduling:

```bash
npm run *projectname*:badge:once
```

### Dry Run

```bash
npm run *projectname*:badge:dry-run
```

### Export Addresses

```bash
npm run *projectname*:badge:address
```
