# MuBadges Leaderboard Scheduler

This document provides a quick-start guide for using the MuBadges Leaderboard Scheduler system.

## What is the Leaderboard Scheduler?

The Leaderboard Scheduler is an automated system that generates different types of leaderboards at configurable intervals. It ensures your community leaderboards are always up-to-date without requiring manual intervention.

## Quick Start

### Installation

Make sure you have all dependencies installed:

```bash
npm install
```

### Configuration

The scheduler is configured in `config/tokens.json`:

```json
"scheduler": {
  "intervalHours": 6,
  "leaderboardIntervalHours": 24,
  "leaderboardTypes": ["standard", "mu"]
}
```

- `leaderboardIntervalHours`: How often to generate leaderboards (in hours)
- `leaderboardTypes`: Which leaderboard types to generate

### Running the Scheduler

To start the scheduler with default settings:

```bash
npm run leaderboard-scheduler
```

To generate only specific leaderboard types:

```bash
# Generate only the standard leaderboard
npm run leaderboard-scheduler standard

# Generate only the MU leaderboard
npm run leaderboard-scheduler mu
```

## Leaderboard Types

The system currently supports:

1. **Standard Leaderboard**: Uses configurable point weights from `config/leaderboard.json`
2. **MU Leaderboard**: Uses dynamic point calculation based on contract-provided prices:
   - MU tokens = 2 points per token
   - MUG tokens = points equal to the MUG/MU price from contract
   - MUO tokens = 1.1x the MUG/MU price
   - MUV tokens = 10x the MUO price
   - Mu Pups NFTs = 10x the MUG/MU price per NFT

## Output

Leaderboards are saved to:
- JSON: `files/leaderboard.json`
- HTML: `files/leaderboard.html`

## Logs

The scheduler creates logs in the `logs/` directory for monitoring and troubleshooting.

## Running as a Service

For production environments, you can use PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start the scheduler as a service
pm2 start npm --name "mubadges-leaderboard-scheduler" -- run leaderboard-scheduler

# Ensure it starts on system boot
pm2 startup
pm2 save
```

## Troubleshooting

If you encounter issues:

1. Check the log files in the `logs/` directory
2. Verify your API keys in the `.env` file
3. Ensure you have proper network connectivity

## Further Documentation

For more detailed information, see:
- [LEADERBOARD_SCHEDULER.md](./LEADERBOARD_SCHEDULER.md): Complete documentation
- [LEADERBOARD_CLASSES.md](./LEADERBOARD_CLASSES.md): Information about the class-based leaderboard system
- [MORALIS_API_KEY_ROTATION.md](./MORALIS_API_KEY_ROTATION.md): Details about the Moralis API key rotation feature
