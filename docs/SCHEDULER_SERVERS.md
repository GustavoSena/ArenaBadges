# MuBadges Scheduler Servers

This document describes the scheduler servers implemented for the MuBadges project.

## Overview

The MuBadges project now includes two robust server implementations:

1. **Badge Scheduler Server**: Handles the badge distribution process on a scheduled basis
2. **Leaderboard Scheduler Server**: Manages leaderboard generation and serves the HTML leaderboard pages

Both servers run on different ports on the same machine and can be started individually or together.

## Configuration

The servers use the following environment variables:

- `BADGE_SERVER_PORT`: Port for the badge scheduler server (default: 3000)
- `LEADERBOARD_SERVER_PORT`: Port for the leaderboard scheduler server (default: 3001)
- `API_KEY`: Required for the badge scheduler to send data to the API
- `ALCHEMY_API_KEY`: Required for blockchain data access
- `MORALIS_API_KEYS`: Array of Moralis API keys for key rotation

## Server Endpoints

### Badge Scheduler Server (Default Port: 3000)

- `GET /health`: Health check endpoint
- `GET /status`: Status information including last run and next scheduled run
- `POST /trigger`: Manually trigger the badge scheduler to run

### Leaderboard Scheduler Server (Default Port: 3001)

- `GET /`: Serves the standard leaderboard HTML page
- `GET /mu`: Serves the MU leaderboard HTML page
- `GET /health`: Health check endpoint
- `GET /status`: Status information including last run and next scheduled run
- `POST /trigger`: Manually trigger the leaderboard generation

## Running the Servers

You can run the servers using the following npm scripts:

```bash
# Run the badge scheduler server
npm run badge-server

# Run the leaderboard scheduler server
npm run leaderboard-server

# Run both servers simultaneously
npm run start-servers
```

## Leaderboard Update Schedule

The leaderboard server refreshes its data every 3 hours, but the HTML pages are continuously available. This means users can always access the leaderboard, even while new data is being generated.

## Server Robustness

The servers include the following robustness features:

1. **Error Handling**: Comprehensive error handling to prevent crashes
2. **Logging**: Detailed logging of operations and errors
3. **Health Endpoints**: Health check endpoints for monitoring
4. **Status Tracking**: Tracking of last run and next scheduled run times
5. **Manual Triggers**: Ability to manually trigger processes via API endpoints

## File Structure

- `src/badgeSchedulerServer.ts`: Badge scheduler server implementation
- `src/leaderboardSchedulerServer.ts`: Leaderboard scheduler server implementation
- `src/startServers.ts`: Script to start both servers simultaneously
- `src/services/schedulerService.ts`: Badge scheduler service implementation
- `src/services/leaderboardSchedulerService.ts`: Leaderboard scheduler service implementation

## Output Files

- Badge data is sent to the Arena Social Badges API
- Leaderboard HTML files are saved to the `public` directory:
  - `public/leaderboard.html`: Standard leaderboard
  - `public/mu_leaderboard.html`: MU leaderboard
