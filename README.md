# MuBadges

A badge and leaderboard automation system for Mu community tokens and NFTs.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your API keys:
   ```
   cp .env.example .env
   ```
   - Required API keys:
     - `MORALIS_API_KEYS`: Array of keys for blockchain data access
     - `ALCHEMY_API_KEY`: For blockchain data access
     - `API_KEY`: For Arena Social badge API access

## Configuration

The project uses two main configuration files:

- `config/tokens.json`: Configure tokens, NFTs, API endpoints, and scheduler settings
- `config/mu_leaderboard.json`: Configure leaderboard display settings

## Running the Project

To start the application with default settings:

```
npm start
```

This will start both the badge and leaderboard schedulers with the intervals defined in the configuration.

### Verbose Mode

To run with detailed logging:

```
npm run start:verbose
```

### Individual Schedulers

To run only the badge scheduler:
```
npm run badges
```

To run only the leaderboard scheduler:
```
npm run leaderboard
```

Verbose versions are also available:
```
npm run badges:verbose
npm run leaderboard:verbose
```

## Output

All generated files are saved to the `output` directory:
- Badge data: `output/badges/`
- Leaderboard HTML: `output/leaderboards/`
