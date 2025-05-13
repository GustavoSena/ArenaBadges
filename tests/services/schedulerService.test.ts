import { startScheduler } from '../../src/services/schedulerService';
import { fetchTokenHolderProfiles, HolderResults } from '../../src/services/holderService';
import { sendResultsToApi } from '../../src/services/apiService';
import * as helpers from '../../src/utils/helpers';

// Mock the modules
jest.mock('../../src/services/holderService');
jest.mock('../../src/services/apiService');

// Create proper mock types
const mockedFetchTokenHolderProfiles = fetchTokenHolderProfiles as jest.MockedFunction<typeof fetchTokenHolderProfiles>;
const mockedSendResultsToApi = sendResultsToApi as jest.MockedFunction<typeof sendResultsToApi>;

describe('schedulerService', () => {
  // Setup test data
  const mockApiKey = 'test-api-key';
  const mockIntervalMs = 1000; // 1 second for testing
  const mockApiResponse = {
    tier1Response: { success: true },
    tier2Response: { success: true }
  };
  const mockHolderResults: HolderResults = {
    nftHolders: ['user1', 'user2', 'user3'],
    combinedHolders: ['user4', 'user5']
  };
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock the functions
    mockedFetchTokenHolderProfiles.mockResolvedValue(mockHolderResults);
    mockedSendResultsToApi.mockResolvedValue(mockApiResponse);
    
    // Mock setInterval to not actually call the callback to avoid duplicate calls
    jest.spyOn(global, 'setInterval').mockImplementation((callback: Function) => {
      // Don't call the callback here to avoid duplicate calls
      return 123 as unknown as NodeJS.Timeout; // Return a dummy interval ID
    });
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore mocks
    jest.restoreAllMocks();
  });
  
  test('should start the scheduler and run immediately', async () => {
    // Call the function
    startScheduler({
      intervalMs: mockIntervalMs,
      apiKey: mockApiKey
    });
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledTimes(1);
    
    // Verify sendResultsToApi was called with the correct arguments
    expect(mockedSendResultsToApi).toHaveBeenCalledTimes(1);
    expect(mockedSendResultsToApi).toHaveBeenCalledWith(mockApiKey, mockHolderResults);
    
    // Verify setInterval was called with the correct interval
    expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), mockIntervalMs);
  });
  
  test('should throw error when API key is not provided', () => {
    // Mock loadConfig to return a valid config to avoid other errors
    jest.spyOn(helpers, 'loadConfig')
      .mockReturnValue({
        scheduler: { intervalHours: 6 },
        api: { baseUrl: 'http://test.com', endpoints: { nftOnly: 'test', combined: 'test' } },
        tokens: [{ address: '0x123', symbol: 'TEST', decimals: 18, minBalance: 1 }],
        nfts: [{ address: '0x456', name: 'TEST NFT', minBalance: 1 }]
      });
    
    // Save original environment and clear API_KEY
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.API_KEY;
      
    // Call the function without API key and expect it to throw
    expect(() => {
      startScheduler({
        intervalMs: mockIntervalMs,
        apiKey: undefined
      });
    }).toThrow('API key is required');
    
    // Restore environment
    process.env = originalEnv;
  });
  
  test('should use environment variables when config is not provided', async () => {
    // Mock process.env
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      API_KEY: mockApiKey
    };
    
    // Call the function without config
    startScheduler();
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify sendResultsToApi was called with the correct arguments from env
    expect(mockedSendResultsToApi).toHaveBeenCalledWith(mockApiKey, mockHolderResults);
    
    // Restore process.env
    process.env = originalEnv;
  });
  
  test('should handle errors in fetchTokenHolderProfiles', async () => {
    // Mock fetchTokenHolderProfiles to throw an error
    const mockError = new Error('Failed to fetch profiles');
    mockedFetchTokenHolderProfiles.mockRejectedValue(mockError);
    
    // Call the function
    startScheduler({
      intervalMs: mockIntervalMs,
      apiKey: mockApiKey
    });
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
    
    // Verify sendResultsToApi was not called
    expect(mockedSendResultsToApi).not.toHaveBeenCalled();
  });
});
