import { startLeaderboardScheduler, LeaderboardType } from '../../src/services/leaderboardSchedulerService';
import { generateAndSaveLeaderboard } from '../../src/services/leaderboardService';
import { generateAndSaveMuLeaderboard } from '../../src/services/leaderboardClassService';
import { loadConfig } from '../../src/utils/helpers';
import * as fs from 'fs';
import * as path from 'path';

// Mock the modules
jest.mock('../../src/services/leaderboardService');
jest.mock('../../src/services/leaderboardClassService');
jest.mock('../../src/utils/helpers');
jest.mock('fs');
jest.mock('path');

// Create proper mock types
const mockedGenerateAndSaveLeaderboard = generateAndSaveLeaderboard as jest.MockedFunction<typeof generateAndSaveLeaderboard>;
const mockedGenerateAndSaveMuLeaderboard = generateAndSaveMuLeaderboard as jest.MockedFunction<typeof generateAndSaveMuLeaderboard>;
const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockedPathJoin = path.join as jest.MockedFunction<typeof path.join>;
const mockedFsExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockedFsMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
const mockedFsWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;
const mockedFsAppendFileSync = fs.appendFileSync as jest.MockedFunction<typeof fs.appendFileSync>;

describe('leaderboardSchedulerService', () => {
  // Setup test data
  const mockIntervalMs = 1000; // 1 second for testing
  const mockLogDir = '/mock/logs';
  const mockLogFile = '/mock/logs/leaderboard_test.log';
  const mockLeaderboardConfig = {
    standard: {
      // Mock standard leaderboard config
    },
    mu: {
      // Mock MU leaderboard config
    }
  };
  const mockConfig = {
    scheduler: {
      intervalHours: 6,
      leaderboardIntervalHours: 12,
      leaderboardTypes: ['standard', 'mu']
    }
  };
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock the functions
    mockedGenerateAndSaveLeaderboard.mockResolvedValue({
      timestamp: new Date().toISOString(),
      entries: [
        { rank: 1, twitterHandle: 'user1', totalPoints: 1000 },
        { rank: 2, twitterHandle: 'user2', totalPoints: 800 }
      ]
    });
    
    mockedGenerateAndSaveMuLeaderboard.mockResolvedValue({
      timestamp: new Date().toISOString(),
      entries: [
        { rank: 1, twitterHandle: 'user1', totalPoints: 2000 },
        { rank: 2, twitterHandle: 'user3', totalPoints: 1500 }
      ]
    });
    
    mockedLoadConfig.mockReturnValue(mockConfig);
    
    // Mock path and fs functions
    mockedPathJoin.mockImplementation((...paths) => {
      if (paths.includes('logs')) {
        return mockLogDir;
      }
      return mockLogFile;
    });
    
    mockedFsExistsSync.mockReturnValue(false);
    mockedFsMkdirSync.mockImplementation(() => {});
    mockedFsWriteFileSync.mockImplementation(() => {});
    mockedFsAppendFileSync.mockImplementation(() => {});
    
    // Mock setInterval to not actually call the callback to avoid duplicate calls
    jest.spyOn(global, 'setInterval').mockImplementation((callback: Function) => {
      // Don't call the callback here to avoid duplicate calls
      return 123 as unknown as NodeJS.Timeout; // Return a dummy interval ID
    });
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock Date.toISOString to return a consistent value for testing
    const mockDate = new Date('2025-04-29T12:00:00Z');
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate.toISOString());
  });
  
  afterEach(() => {
    // Restore mocks
    jest.restoreAllMocks();
  });
  
  test('should start the scheduler and run immediately with default config', async () => {
    // Call the function with default config
    startLeaderboardScheduler();
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify loadConfig was called
    expect(mockedLoadConfig).toHaveBeenCalledTimes(1);
    
    // Verify both leaderboard generation functions were called
    expect(mockedGenerateAndSaveLeaderboard).toHaveBeenCalledTimes(1);
    expect(mockedGenerateAndSaveMuLeaderboard).toHaveBeenCalledTimes(1);
    
    // Verify log directory was created
    expect(mockedFsExistsSync).toHaveBeenCalledWith(mockLogDir);
    expect(mockedFsMkdirSync).toHaveBeenCalledWith(mockLogDir, { recursive: true });
    
    // Verify log file was created
    expect(mockedFsWriteFileSync).toHaveBeenCalledWith(
      mockLogFile,
      expect.stringContaining('Leaderboard generation started')
    );
    
    // Verify setInterval was called with the correct interval
    expect(global.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      mockConfig.scheduler.leaderboardIntervalHours * 60 * 60 * 1000
    );
  });
  
  test('should only generate specified leaderboard types', async () => {
    // Call the function with only MU leaderboard
    startLeaderboardScheduler({
      leaderboardTypes: [LeaderboardType.MU],
      runImmediately: true
    });
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify only MU leaderboard generation was called
    expect(mockedGenerateAndSaveLeaderboard).not.toHaveBeenCalled();
    expect(mockedGenerateAndSaveMuLeaderboard).toHaveBeenCalledTimes(1);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Call the function with only standard leaderboard
    startLeaderboardScheduler({
      leaderboardTypes: [LeaderboardType.STANDARD],
      runImmediately: true
    });
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify only standard leaderboard generation was called
    expect(mockedGenerateAndSaveLeaderboard).toHaveBeenCalledTimes(1);
    expect(mockedGenerateAndSaveMuLeaderboard).not.toHaveBeenCalled();
  });
  
  test('should not run immediately when runImmediately is false', async () => {
    // Call the function with runImmediately set to false
    startLeaderboardScheduler({
      runImmediately: false
    });
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify no leaderboard generation was called
    expect(mockedGenerateAndSaveLeaderboard).not.toHaveBeenCalled();
    expect(mockedGenerateAndSaveMuLeaderboard).not.toHaveBeenCalled();
    
    // Verify setInterval was still called
    expect(global.setInterval).toHaveBeenCalled();
  });
  
  test('should use custom interval if provided', async () => {
    const customIntervalMs = 3600000; // 1 hour
    
    // Call the function with custom interval
    startLeaderboardScheduler({
      intervalMs: customIntervalMs,
      runImmediately: true
    });
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify setInterval was called with the custom interval
    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), customIntervalMs);
  });
  
  test('should handle errors in leaderboard generation', async () => {
    // Mock generateAndSaveLeaderboard to throw an error
    const mockError = new Error('Failed to generate leaderboard');
    mockedGenerateAndSaveLeaderboard.mockRejectedValue(mockError);
    
    // Call the function
    startLeaderboardScheduler({
      leaderboardTypes: [LeaderboardType.STANDARD, LeaderboardType.MU],
      runImmediately: true
    });
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
    
    // Verify MU leaderboard was still generated despite standard leaderboard error
    expect(mockedGenerateAndSaveMuLeaderboard).toHaveBeenCalledTimes(1);
    
    // Verify error was logged
    expect(mockedFsAppendFileSync).toHaveBeenCalledWith(
      mockLogFile,
      expect.stringContaining('Error generating standard leaderboard')
    );
  });
  
  test('should create log directory if it does not exist', async () => {
    // Call the function
    startLeaderboardScheduler();
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify directory existence was checked
    expect(mockedFsExistsSync).toHaveBeenCalledWith(mockLogDir);
    
    // Verify directory was created
    expect(mockedFsMkdirSync).toHaveBeenCalledWith(mockLogDir, { recursive: true });
  });
  
  test('should not create log directory if it already exists', async () => {
    // Mock directory to already exist
    mockedFsExistsSync.mockReturnValue(true);
    
    // Call the function
    startLeaderboardScheduler();
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify directory existence was checked
    expect(mockedFsExistsSync).toHaveBeenCalledWith(mockLogDir);
    
    // Verify directory was not created
    expect(mockedFsMkdirSync).not.toHaveBeenCalled();
  });
});
