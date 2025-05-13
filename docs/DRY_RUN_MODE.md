# Dry Run Mode for MuBadges

## Overview

The dry run mode allows you to run the badge scheduler without actually sending data to the API endpoints. Instead, it prints the JSON data that would be sent to the console. This is useful for testing and debugging purposes.

## Usage

### Command Line Options

The badge scheduler now supports the following command line options:

- `--dry-run` or `-d`: Enables dry run mode. Data will be printed to the console instead of being sent to the API.
- `--run-once` or `-o`: Runs the scheduler once and exits, without scheduling future runs.
- `--verbose` or `-v`: Enables verbose logging.

### NPM Scripts

The following npm scripts have been added to `package.json`:

```bash
# Run the badge scheduler in dry run mode (once, no scheduling)
npm run badge-scheduler:dry-run

# Run the badge scheduler in dry run mode with verbose logging
npm run badge-scheduler:dry-run:verbose

# Run the badge scheduler once and exit
npm run run-badges-once

# Run the badge scheduler once with verbose logging
npm run run-badges-once:verbose
```

## Programmatic Usage

If you're using the scheduler programmatically, you can enable dry run mode by setting the `dryRun` option to `true`:

```typescript
import { startScheduler } from '../services/schedulerService';

startScheduler({
  apiKey: 'your-api-key',
  dryRun: true,
  runOnce: true, // Optional: run once and exit
  verbose: true  // Optional: enable verbose logging
});
```

## Output Format

When running in dry run mode, the scheduler will print the following information to the console:

1. A message indicating that dry run mode is enabled
2. The NFT-only data that would be sent to the API, including the endpoint URL
3. The combined data that would be sent to the API, including the endpoint URL
4. A message indicating that the dry run has completed and no data was sent to the API

## Example Output

```
Starting scheduled data collection at 2025-05-13T16:30:00.000Z
Running in dry run mode - will print JSON instead of sending to API
DRY RUN MODE: Printing JSON to console instead of sending to API

NFT-ONLY DATA (would be sent to http://api.arena.social/badges/mu-tier-1):
{
  "handles": [
    "user1",
    "user2",
    "user3"
  ],
  "timestamp": "2025-05-13T16:30:00.000Z"
}

COMBINED DATA (would be sent to http://api.arena.social/badges/mu-tier-2):
{
  "handles": [
    "user1",
    "user2",
    "user3",
    "user4",
    "user5"
  ],
  "timestamp": "2025-05-13T16:30:00.000Z"
}

DRY RUN COMPLETED - No data was sent to the API
Completed scheduled run at 2025-05-13T16:30:05.000Z
Run once mode enabled - not scheduling next run
```
