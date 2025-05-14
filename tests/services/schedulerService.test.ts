import { runAndSendResults, ErrorType } from '../../src/badges/services/schedulerService';
import { fetchTokenHolderProfiles } from '../../src/badges/profiles/fetchTokenHolderProfiles';
import { sendResults } from '../../src/badges/profiles/sendResults';
import * as helpers from '../../src/utils/helpers';

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
    upgradedHolders: ['user4', 'user5']
  };
  const mockProjectName = 'mu';
  
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
    // Call the function with the new signature
    await runAndSendResults(undefined, false, false, mockProjectName);

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledTimes(1);
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledWith(false);

    // Verify sendResults was called with the correct arguments
    expect(mockedSendResults).toHaveBeenCalledTimes(1);
    expect(mockedSendResults).toHaveBeenCalledWith({
      basicHolders: mockHolderResults.basicHolders,
      upgradedHolders: mockHolderResults.upgradedHolders,
      timestamp: expect.any(String)
    }, { dryRun: false, projectName: mockProjectName });

    // runAndSendResults doesn't call setInterval, that's done in startScheduler
  });

  test('should run in dry-run mode successfully', async () => {
    // Call the function with dry-run mode
    await runAndSendResults(undefined, false, true, mockProjectName);

    // Verify fetchTokenHolderProfiles was called
    expect(mockedFetchTokenHolderProfiles).toHaveBeenCalledTimes(1);

    // Verify sendResults was called with dryRun: true
    expect(mockedSendResults).toHaveBeenCalledWith({
      basicHolders: mockHolderResults.basicHolders,
      upgradedHolders: mockHolderResults.upgradedHolders,
      timestamp: expect.any(String)
    }, { dryRun: true, projectName: mockProjectName });
  });

  test('should run once when runOnce is true', async () => {
    // Call the function with verbose: true
    await runAndSendResults(undefined, true, false, mockProjectName);

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
    const result = await runAndSendResults(undefined, false, false, mockProjectName);

    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();

    // Verify sendResults was not called
    expect(mockedSendResults).not.toHaveBeenCalled();
    
    // Verify the error type is returned
    expect(result).toBe(ErrorType.OTHER);
  });
});
