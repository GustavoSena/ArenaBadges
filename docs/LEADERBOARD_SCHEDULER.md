# Leaderboard Scheduler System

This document explains the automated leaderboard generation system implemented in the MuBadges project, which allows for scheduled generation of different types of leaderboards.

## Overview

The leaderboard scheduler system provides an automated way to generate different types of leaderboards at configurable intervals. This ensures that leaderboards are always up-to-date without requiring manual intervention.

Key features:
- Scheduled generation of multiple leaderboard types
- Configurable intervals for each leaderboard type
- Logging of generation events for monitoring
- Command-line options for selective generation
- Error resilience with independent generation processes

## Configuration

The leaderboard scheduler is configured in the `config/tokens.json` file under the `scheduler` section:

```json
"scheduler": {
  "intervalHours": 6,
  "leaderboardIntervalHours": 24,
  "leaderboardTypes": ["standard", "mu"]
}
```

- `intervalHours`: Interval for the main data collection scheduler (badge generation)
- `leaderboardIntervalHours`: Interval for leaderboard generation (defaults to 24 hours if not specified)
- `leaderboardTypes`: Array of leaderboard types to generate (defaults to all types if not specified)

## Leaderboard Types

The system currently supports the following leaderboard types:

1. **Standard Leaderboard** (`standard`): The original leaderboard with configurable point weights from `config/leaderboard.json`
2. **MU Leaderboard** (`mu`): The class-based leaderboard with dynamic point calculation based on contract-provided prices

Each leaderboard type has its own generation logic and output format, but they share the same scheduling infrastructure.

## Usage

### Running the Scheduler

To start the leaderboard scheduler with default settings:

```bash
npm run leaderboard-scheduler
```

This will generate all configured leaderboard types at the interval specified in the configuration.

### Generating Specific Leaderboard Types

You can specify which leaderboard types to generate by passing them as command-line arguments:

```bash
# Generate only the standard leaderboard
npm run leaderboard-scheduler standard

# Generate only the MU leaderboard
npm run leaderboard-scheduler mu

# Generate both leaderboards
npm run leaderboard-scheduler standard mu
```

### Running as a Service

For production environments, you may want to run the scheduler as a system service. Here's how to set it up with PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start the leaderboard scheduler as a service
pm2 start npm --name "mubadges-leaderboard-scheduler" -- run leaderboard-scheduler

# Ensure it starts on system boot
pm2 startup
pm2 save
```

## Logs

The scheduler creates detailed logs for each leaderboard generation run in the `logs/` directory. Each log file contains:

- Timestamp of the generation start
- Status of each leaderboard generation (success or error)
- Timestamp of the generation completion
- Error details if any generation failed

Log files are named using the format: `leaderboard_YYYY-MM-DDTHH-MM-SS.SSS.log`

Example log file content:
```
Leaderboard generation started at 2025-04-29T22:00:00.000Z
Successfully generated standard leaderboard
Successfully generated mu leaderboard
Leaderboard generation completed at 2025-04-29T22:01:30.000Z
```

## Technical Implementation

The leaderboard scheduler system is implemented in the following files:

- `src/services/leaderboardSchedulerService.ts`: Core scheduler service that manages the generation intervals
- `src/leaderboardScheduler.ts`: Entry point for the scheduler with command-line argument parsing
- `tests/services/leaderboardSchedulerService.test.ts`: Comprehensive tests for the scheduler

### Architecture

The system follows a modular design:

1. **LeaderboardType Enum**: Defines the available leaderboard types
   ```typescript
   export enum LeaderboardType {
     STANDARD = 'standard',
     MU = 'mu'
   }
   ```

2. **Configuration Interface**: Defines the structure for scheduler configuration
   ```typescript
   export interface LeaderboardSchedulerConfig {
     leaderboardTypes?: LeaderboardType[];
     intervalMs?: number;
     runImmediately?: boolean;
   }
   ```

3. **Generation Functions**: Separate functions for generating each type of leaderboard
   ```typescript
   async function generateLeaderboard(type: LeaderboardType): Promise<void> {
     switch (type) {
       case LeaderboardType.STANDARD:
         await generateAndSaveLeaderboard();
         break;
       case LeaderboardType.MU:
         await generateAndSaveMuLeaderboard();
         break;
     }
   }
   ```

4. **Scheduler Function**: Manages the timing and execution of leaderboard generation
   ```typescript
   export function startLeaderboardScheduler(config: LeaderboardSchedulerConfig = DEFAULT_CONFIG): void {
     // Configuration loading and setup
     
     // Run immediately if configured
     if (runImmediately) {
       runLeaderboardGeneration(leaderboardTypes);
     }
     
     // Schedule future runs
     setInterval(() => {
       runLeaderboardGeneration(leaderboardTypes);
     }, intervalMs);
   }
   ```

### Error Handling

The scheduler implements robust error handling to ensure that:

1. Errors in one leaderboard generation don't affect others
2. All errors are properly logged for troubleshooting
3. The scheduler continues to run even if some generations fail

Error handling is implemented at multiple levels:
- Try/catch blocks around individual leaderboard generations
- Detailed error logging to both console and log files
- Continuation of the scheduler despite errors

## Integration with Existing Systems

The leaderboard scheduler integrates with:

1. **Class-based Leaderboard System**: Uses the abstract leaderboard classes for generating the MU leaderboard
2. **Standard Leaderboard Service**: Uses the original leaderboard service for generating the standard leaderboard
3. **Configuration System**: Reads settings from the same configuration files used by other components

## Performance Considerations

When running the leaderboard scheduler, consider the following performance aspects:

1. **API Rate Limits**: The generation process makes multiple API calls, so be mindful of rate limits
2. **Resource Usage**: Generating multiple leaderboards can be resource-intensive
3. **Interval Timing**: Set appropriate intervals based on how frequently your data changes

For large datasets or frequent updates, consider:
- Staggering the generation of different leaderboard types
- Implementing caching mechanisms for blockchain data
- Optimizing the point calculation logic for performance

## Adding New Leaderboard Types

To add a new leaderboard type to the scheduler:

1. Add the new type to the `LeaderboardType` enum in `leaderboardSchedulerService.ts`
   ```typescript
   export enum LeaderboardType {
     STANDARD = 'standard',
     MU = 'mu',
     NEW_TYPE = 'new-type'
   }
   ```

2. Implement the generation function for the new type
   ```typescript
   // In your service file
   export async function generateAndSaveNewTypeLeaderboard(): Promise<Leaderboard> {
     // Implementation
   }
   ```

3. Add a case for the new type in the `generateLeaderboard` function
   ```typescript
   async function generateLeaderboard(type: LeaderboardType): Promise<void> {
     switch (type) {
       // Existing cases...
       case LeaderboardType.NEW_TYPE:
         await generateAndSaveNewTypeLeaderboard();
         break;
     }
   }
   ```

4. Update the configuration file to include the new type in the `leaderboardTypes` array
   ```json
   "scheduler": {
     "leaderboardIntervalHours": 24,
     "leaderboardTypes": ["standard", "mu", "new-type"]
   }
   ```

## Troubleshooting

### Common Issues

1. **Leaderboard not generating**
   - Check the logs for error messages
   - Verify that the leaderboard type is correctly specified in the configuration
   - Ensure that the required API keys are set in the .env file

2. **Scheduler not running at expected intervals**
   - Verify the `leaderboardIntervalHours` setting in the configuration
   - Check if the process is being terminated unexpectedly

3. **Error in leaderboard generation**
   - Look for specific error messages in the logs
   - Check API key validity and rate limits
   - Verify blockchain connectivity

### Debugging

For detailed debugging:

1. Run the scheduler with a specific leaderboard type to isolate issues:
   ```bash
   npm run leaderboard-scheduler mu
   ```

2. Check the log files in the `logs/` directory for detailed error information

3. Modify the log level for more verbose output by editing the console log statements in the code

## Best Practices

1. **Staggered Scheduling**: If generating multiple leaderboard types, consider staggering their generation times to avoid resource contention

2. **Regular Monitoring**: Review the log files periodically to ensure all leaderboard generations are completing successfully

3. **Backup Strategy**: Implement a backup strategy for leaderboard data to prevent data loss

4. **Resource Considerations**: Be mindful of API rate limits and system resources when configuring generation intervals

5. **Testing**: Always test new leaderboard types thoroughly before adding them to the production scheduler
