import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Save the original environment
const originalEnv = process.env;

// Set up environment variables before importing the module under test
process.env = {
  ...originalEnv,
  BADGE_KEYS: JSON.stringify({
    mu: 'test-api-key',
    boi: 'other-test-key'
  })
};

// We need to mock the modules before importing the module under test
jest.mock('axios');
jest.mock('fs');
jest.mock('path');

// Now import the module under test
import { sendResults } from '../../src/badges/profiles/sendResults';
import { BadgeConfig } from '../../src/types/badge';
import { RunOptions } from '../../src/badges/services/schedulerService';

// Create proper mock types
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;

describe.skip('apiService', () => {
  // Setup test data
  const mockBasicHolders = { handles: ['user1', 'user2', 'user3'] };
  const mockUpgradedHolders = { handles: ['user4', 'user5'] };
  
  // Mock holder results
  const mockResults = {
    basicHolders: ['user1', 'user2', 'user3'],
    upgradedHolders: ['user4', 'user5'],
    basicAddresses: ['0x123', '0x456', '0x789'],
    upgradedAddresses: ['0xabc', '0xdef'],
    timestamp: new Date().toISOString()
  };
  
  // Mock file paths
  const mockBasicPath = '/mocked/path/to/basic_holders.json';
  const mockUpgradedPath = '/mocked/path/to/upgraded_holders.json';
  
  // Mock API key
  const mockApiKey = 'test-api-key';
  
  // Mock BadgeConfig
  const mockBadgeConfig: BadgeConfig = {
    name: 'Test Project',
    projectName: 'mu',
    badges: {
      basic: {
        tokens: [
          { address: '0x123', symbol: 'TEST', decimals: 18, minBalance: 1 }
        ]
      },
      upgraded: {
        tokens: [
          { address: '0x456', symbol: 'TEST', decimals: 18, minBalance: 10 }
        ]
      }
    },
    excludedAccounts: [],
    permanentAccounts: [],
    api: {
      baseUrl: 'http://test-api.com',
      endpoints: {
        basic: 'basic-endpoint',
        upgraded: 'upgraded-endpoint'
      }
    },
    excludeBasicForUpgraded: false,
    sumOfBalances: true
  };
  
  // Mock RunOptions
  const mockOptions: RunOptions = {
    dryRun: false,
    exportAddresses: false
  };
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock path.join to return our mock paths
    mockedPath.join.mockImplementation((dir, relativePath) => {
      if (relativePath && relativePath.includes('basic_holders.json')) {
        return mockBasicPath;
      }
      return mockUpgradedPath;
    });
    
    // Mock fs.existsSync to return false (no previous files)
    mockedFs.existsSync.mockReturnValue(false);
    
    // Mock fs.readFileSync to return our test data
    mockedFs.readFileSync.mockImplementation((path, options) => {
      // Default to upgraded holders if path is undefined or can't be determined
      return JSON.stringify(path === mockBasicPath ? mockBasicHolders : mockUpgradedHolders);
    });
    
    // No need to mock process.env here as we've already set it up before importing the module
    
    // Mock axios.post to return a successful response
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { success: true }
    });
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore mocks
    jest.restoreAllMocks();
  });
  
  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });
  
  test('should send data to API with correct payload when no previous files exist', async () => {
    // Mock fs.existsSync to return false (no previous files)
    mockedFs.existsSync.mockReturnValue(false);
    
    // Call the function with the new signature
    await sendResults(mockBadgeConfig, mockApiKey, mockResults, mockOptions);
    
    // Verify axios.post was called twice (once for each tier)
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    
    // Verify first call (Basic badge holders)
    const basicCall = mockedAxios.post.mock.calls[0];
    expect(basicCall[0]).toContain('basic-endpoint'); // Updated to match our mock config
    expect(basicCall[0]).toContain(`key=${mockApiKey}`);
    expect(basicCall[1]).toHaveProperty('handles', mockResults.basicHolders);
    expect(basicCall[1]).toHaveProperty('timestamp');
    expect(basicCall[2]).toEqual({
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Verify second call (Upgraded badge holders)
    const upgradedCall = mockedAxios.post.mock.calls[1];
    expect(upgradedCall[0]).toContain('upgraded-endpoint'); // Updated to match our mock config
    expect(upgradedCall[0]).toContain(`key=${mockApiKey}`);
    expect(upgradedCall[1]).toHaveProperty('handles', mockResults.upgradedHolders);
    expect(upgradedCall[1]).toHaveProperty('timestamp');
    expect(upgradedCall[2]).toEqual({
      headers: {
        'Content-Type': 'application/json'
      }
    });
  });
  
  test('should not send data to API in dry run mode', async () => {
    // Set dryRun option to true
    const dryRunOptions: RunOptions = {
      ...mockOptions,
      dryRun: true
    };
    
    // Call the function with dryRun set to true
    const result = await sendResults(mockBadgeConfig, mockApiKey, mockResults, dryRunOptions);
    
    // Verify the result contains dry-run status
    expect(result).toEqual({
      basic: { status: 'dry-run', handles: mockResults.basicHolders.length },
      upgraded: { status: 'dry-run', handles: mockResults.upgradedHolders.length }
    });
    
    // Verify axios.post was not called
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  
  test('should throw error when project name is not provided', async () => {
    // Create a bad config without project name
    const badConfig = { ...mockBadgeConfig, projectName: '' };
    
    // Call the function without a project name and expect it to throw
    await expect(sendResults(badConfig, mockApiKey, mockResults, mockOptions)).rejects.toThrow('Project name is required');
  });
  
  test('should handle API errors gracefully', async () => {
    // Mock axios.post to throw an error
    const mockError = new Error('API request failed');
    mockedAxios.post.mockRejectedValue(mockError);
    
    // Call the function and expect it to throw
    await expect(sendResults(mockBadgeConfig, mockApiKey, mockResults, mockOptions)).rejects.toThrow();
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
  });
  
  test('should handle API errors gracefully when sending data', async () => {
    // Mock axios.post to throw an error for the first call only
    mockedAxios.post.mockImplementationOnce(() => {
      throw new Error('API request failed');
    });
    
    // Mock console.error to capture calls
    const consoleErrorSpy = jest.spyOn(console, 'error');
    
    // Call the function and expect it to throw
    await expect(sendResults(mockBadgeConfig, mockApiKey, mockResults, mockOptions)).rejects.toThrow('API request failed');
    
    // Verify console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
