import { runAndSendResults, ErrorType } from '../../src/badges/services/schedulerService';
import { fetchBadgeHolders } from '../../src/badges/profiles/fetchBadgeHolder';
import { sendResults } from '../../src/badges/profiles/sendResults';
import { AppConfig } from '../../src/utils/config';
import logger from '../../src/utils/logger';
// Mock the modules
jest.mock('../../src/badges/profiles/fetchBadgeHolder');
jest.mock('../../src/badges/profiles/sendResults');
jest.spyOn(logger, 'log').mockImplementation(() => {});
jest.spyOn(logger, 'verboseLog').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});
// Create proper mock types
const mockedFetchBadgeHolders = fetchBadgeHolders as jest.MockedFunction<typeof fetchBadgeHolders>;
const mockedSendResults = sendResults as jest.MockedFunction<typeof sendResults>;

describe('schedulerService', () => {
  // Setup test data
  const mockIntervalMs = 1000; // 1 second for testing
  const mockApiResponse = {
    success: true
  };
  const mockHolderResults = {
    basicHolders: ['user1', 'user2', 'user3'],
    upgradedHolders: ['user4', 'user5'],
    basicAddresses: ['0x1', '0x2', '0x3'],
    upgradedAddresses: ['0x4', '0x5'],
    nftHolders: [],
    combinedHolders: []
  };
  const mockProjectName = 'mu';
  
  // Create mock AppConfig
  const mockAppConfig: AppConfig = {
    projectName: mockProjectName,
    projectConfig: {
      scheduler: {
        badgeIntervalHours: 24,
        badgeRetryIntervalHours: 2
      },
      walletMappingFile: 'wallets.json'
    },
    badgeConfig: {
      name: 'Test Badge',
      projectName: mockProjectName,
      badges: {
        basic: { tokens: [] },
        upgraded: { tokens: [] }
      },
      excludedAccounts: [],
      permanentAccounts: [],
      api: {
        baseUrl: 'https://api.example.com',
        endpoints: {
          basic: '/badges/basic',
          upgraded: '/badges/upgraded'
        }
      },
      excludeBasicForUpgraded: false,
      sumOfBalances: true
    }
  };
  
  // Mock environment variables
  const originalEnv = process.env;
  
  beforeAll(() => {
    // Setup mock environment variables
    process.env = {
      ...originalEnv,
      BADGE_KEYS: JSON.stringify({
        mu: 'test-api-key',
        boi: 'other-test-key'
      })
    };
  });
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock the functions
    mockedFetchBadgeHolders.mockResolvedValue({
      basicHolders: mockHolderResults.basicHolders,
      upgradedHolders: mockHolderResults.upgradedHolders,
      basicAddresses: mockHolderResults.basicAddresses,
      upgradedAddresses: mockHolderResults.upgradedAddresses,
      timestamp: new Date().toISOString()
    });
    mockedSendResults.mockResolvedValue(mockApiResponse);
    
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
  
  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  test('should run and send results successfully', async () => {
    // Call the function with the mock AppConfig and run options
    await runAndSendResults(mockAppConfig, { dryRun: false, runOnce: false }, 'test-api-key');

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchBadgeHolders).toHaveBeenCalledTimes(1);
    expect(mockedFetchBadgeHolders).toHaveBeenCalledWith(mockAppConfig);

    // Verify sendResults was called with the correct arguments
    expect(mockedSendResults).toHaveBeenCalledTimes(1);
    expect(mockedSendResults).toHaveBeenCalledWith(
      mockAppConfig.badgeConfig,
      {
        basicHolders: mockHolderResults.basicHolders,
        upgradedHolders: mockHolderResults.upgradedHolders,
        basicAddresses: mockHolderResults.basicAddresses,
        upgradedAddresses: mockHolderResults.upgradedAddresses,
        timestamp: expect.any(String)
      }, 
      { dryRun: false, runOnce: false },
      'test-api-key'
    );
  });

  test('should run in dry-run mode successfully', async () => {
    // Call the function with dry-run mode
    await runAndSendResults(mockAppConfig, { dryRun: true }, 'test-api-key');

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchBadgeHolders).toHaveBeenCalledTimes(1);

    // Verify sendResults was called with dryRun: true
    expect(mockedSendResults).toHaveBeenCalledWith(
      mockAppConfig.badgeConfig,
      {
        basicHolders: mockHolderResults.basicHolders,
        upgradedHolders: mockHolderResults.upgradedHolders,
        basicAddresses: mockHolderResults.basicAddresses,
        upgradedAddresses: mockHolderResults.upgradedAddresses,
        timestamp: expect.any(String)
      }, 
      { dryRun: true },
      'test-api-key'
    );
  });

  test('should run once when runOnce is true', async () => {
    // Call the function with runOnce: true
    await runAndSendResults(mockAppConfig, { runOnce: true }, 'test-api-key');

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchBadgeHolders).toHaveBeenCalledTimes(1);

    // Verify sendResults was called
    expect(mockedSendResults).toHaveBeenCalledTimes(1);

    // Verify setInterval was NOT called
    expect(global.setInterval).not.toHaveBeenCalled();
  });

  test('should handle errors in fetchTokenHolderProfiles', async () => {
    // Mock fetchTokenHolderProfiles to throw an error
    const mockError = new Error('Failed to fetch profiles');
    mockedFetchBadgeHolders.mockRejectedValue(mockError);
    
    // Call the function
    const result = await runAndSendResults(mockAppConfig, { dryRun: false }, 'test-api-key');

    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();

    // Verify sendResults was not called
    expect(mockedSendResults).not.toHaveBeenCalled();
    
    // Verify the error type is returned
    expect(result).toBe(ErrorType.RETRY_FAILURE);
  });
});
