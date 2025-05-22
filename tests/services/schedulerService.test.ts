import { runAndSendResults, ErrorType } from '../../src/badges/services/schedulerService';
import { fetchTokenHolderProfiles } from '../../src/badges/profiles/fetchTokenHolderProfiles';
import { sendResults } from '../../src/badges/profiles/sendResults';
import { AppConfig } from '../../src/utils/config';

// Mock the modules
jest.mock('../../src/badges/profiles/fetchTokenHolderProfiles');
jest.mock('../../src/badges/profiles/sendResults');

// Create proper mock types
const mockedFetchTokenHolderProfiles = fetchTokenHolderProfiles as jest.MockedFunction<typeof fetchTokenHolderProfiles>;
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
    mockedFetchTokenHolderProfiles.mockResolvedValue(mockHolderResults);
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
    await runAndSendResults(mockAppConfig, 'test-api-key', { dryRun: false, runOnce: false });

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledTimes(1);
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledWith(mockAppConfig, false);

    // Verify sendResults was called with the correct arguments
    expect(mockedSendResults).toHaveBeenCalledTimes(1);
    expect(mockedSendResults).toHaveBeenCalledWith(
      mockAppConfig.badgeConfig,
      'test-api-key',
      {
        basicHolders: mockHolderResults.basicHolders,
        upgradedHolders: mockHolderResults.upgradedHolders,
        basicAddresses: mockHolderResults.basicAddresses,
        upgradedAddresses: mockHolderResults.upgradedAddresses,
        timestamp: expect.any(String)
      }, 
      { dryRun: false, runOnce: false }
    );
  });

  test('should run in dry-run mode successfully', async () => {
    // Call the function with dry-run mode
    await runAndSendResults(mockAppConfig, 'test-api-key', { dryRun: true });

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledTimes(1);

    // Verify sendResults was called with dryRun: true
    expect(mockedSendResults).toHaveBeenCalledWith(
      mockAppConfig.badgeConfig,
      'test-api-key',
      {
        basicHolders: mockHolderResults.basicHolders,
        upgradedHolders: mockHolderResults.upgradedHolders,
        basicAddresses: mockHolderResults.basicAddresses,
        upgradedAddresses: mockHolderResults.upgradedAddresses,
        timestamp: expect.any(String)
      }, 
      { dryRun: true }
    );
  });

  test('should run once when runOnce is true', async () => {
    // Call the function with runOnce: true
    await runAndSendResults(mockAppConfig, 'test-api-key', { runOnce: true });

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledTimes(1);

    // Verify sendResults was called
    expect(mockedSendResults).toHaveBeenCalledTimes(1);

    // Verify setInterval was NOT called
    expect(global.setInterval).not.toHaveBeenCalled();
  });

  test('should handle errors in fetchTokenHolderProfiles', async () => {
    // Mock fetchTokenHolderProfiles to throw an error
    const mockError = new Error('Failed to fetch profiles');
    mockedFetchTokenHolderProfiles.mockRejectedValue(mockError);
    
    // Call the function
    const result = await runAndSendResults(mockAppConfig, 'test-api-key', { dryRun: false });

    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();

    // Verify sendResults was not called
    expect(mockedSendResults).not.toHaveBeenCalled();
    
    // Verify the error type is returned
    expect(result).toBe(ErrorType.RETRY_FAILURE);
  });
});
