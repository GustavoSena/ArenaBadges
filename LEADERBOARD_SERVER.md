# MuBadges Leaderboard Server Documentation

## Overview

The MuBadges Leaderboard Server is a robust, standalone server that continuously serves a live HTML leaderboard for MU token and NFT holders. It automatically refreshes data at regular intervals and supports manual refresh via a dedicated script.

## Features

- **Continuous Availability**: The leaderboard HTML is always accessible, even during data refreshes
- **Automatic Refresh**: Leaderboard data refreshes automatically every 3 hours
- **Manual Refresh**: Supports forced refreshes via a dedicated script
- **Worker Process**: All refresh operations run in separate processes for reliability
- **Multiple Leaderboard Types**: 
  - MU Leaderboard (default) - Available at root URL
  - Standard Leaderboard (optional) - Available at /standard endpoint
- **Status Endpoint**: Provides information about last run, next run, and refresh status
- **Health Check**: Simple health check endpoint for monitoring
- **Cloud-Ready**: Configured to run on AWS or other cloud providers

## Architecture

The leaderboard server is built with a robust architecture:

1. **Express Server**: The main server process that handles HTTP requests and serves the leaderboard HTML
2. **Worker Process**: A separate process that handles leaderboard data refreshes
3. **Scheduler**: Automatically triggers refreshes at regular intervals
4. **Refresh Lock**: Prevents concurrent refreshes to avoid data corruption

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the MU leaderboard HTML |
| `/standard` | GET | Serves the standard leaderboard HTML (if generated) |
| `/health` | GET | Health check endpoint |
| `/status` | GET | Shows server status, last run, next run, and refresh status |
| `/trigger` | POST | Triggers a manual refresh of the MU leaderboard |
| `/trigger/standard` | POST | Triggers a manual refresh of the standard leaderboard |
| `/reset-refreshing` | POST | Resets the refreshing flag (used by worker processes) |

## Setup and Usage

### Prerequisites

- Node.js 16+ and npm
- TypeScript
- Environment variables (see Configuration section)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

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

This will send a request to the server to refresh the leaderboard data.

## Configuration

### Environment Variables

The server uses the following environment variables:

- `ALCHEMY_API_KEY` - Your Alchemy API key for blockchain data
- `API_KEY` - Your Arena Social Badges API key
- `MORALIS_API_KEYS` - Comma-separated list of Moralis API keys for rotation
- `LEADERBOARD_SERVER_PORT` - Port for the server (default: 3001)
- `REFRESH_SECRET` - Secret for protecting the refresh endpoint

### Configuration Files

- `config/mu_leaderboard.json` - Configuration for the MU leaderboard
- `config/leaderboard.json` - Configuration for the standard leaderboard

## Deployment

### Local Deployment

For local development and testing, simply run:
```bash
npm run leaderboard-server
```

### Docker Deployment

A Dockerfile and docker-compose.yml are provided for containerized deployment:

```bash
# Build the Docker image
docker build -t mubadges-leaderboard .

# Run the container
docker run -d -p 3001:3001 \
  -e ALCHEMY_API_KEY=your_key \
  -e API_KEY=your_key \
  -e MORALIS_API_KEYS=your_keys \
  -e REFRESH_SECRET=your_secret \
  --name mubadges-leaderboard \
  mubadges-leaderboard
```

Or using docker-compose:
```bash
docker-compose up -d
```

### AWS Deployment

See the [AWS Deployment Guide](aws-deployment.md) for detailed instructions on deploying to AWS EC2 or ECS.

## Troubleshooting

### Common Issues

1. **Worker Process Fails to Start**
   - Check that Node.js is properly installed
   - Ensure the project is built (`npm run build`)
   - Check environment variables

2. **Leaderboard Not Refreshing**
   - Check server logs for errors
   - Verify API keys are valid
   - Check network connectivity to blockchain providers

3. **Server Not Accessible**
   - Verify the server is running (`npm run leaderboard-server`)
   - Check the port configuration
   - Ensure firewall rules allow access to the configured port

## Development

### Project Structure

The project is organized into two main components:

#### Leaderboard Component
- `src/leaderboard/server/leaderboardSchedulerServer.ts` - Main leaderboard server file
- `src/leaderboard/server/refreshWorker.ts` - Worker process for refreshing leaderboard data
- `src/leaderboard/server/refreshLeaderboard.ts` - Script for manual leaderboard refresh
- `src/leaderboard/services/leaderboardSchedulerService.ts` - Leaderboard scheduler service
- `src/leaderboard/services/leaderboardClassService.ts` - Leaderboard generation logic
- `src/leaderboard/services/leaderboardService.ts` - Leaderboard service for data processing

#### Badge Component
- `src/badges/server/badgeSchedulerServer.ts` - Badge scheduler server
- `src/badges/services/schedulerService.ts` - Generic scheduler service

### Adding New Features

To add new endpoints or features:

1. Modify `src/leaderboard/server/leaderboardSchedulerServer.ts` to add new routes
2. Update the worker process if needed
3. Update documentation to reflect changes

## License

This project is licensed under the MIT License - see the LICENSE file for details.
