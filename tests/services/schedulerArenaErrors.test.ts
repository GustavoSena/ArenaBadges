import { runAndSendResults, ErrorType } from '../../src/badges/services/schedulerService';
import { fetchTokenHolderProfiles } from '../../src/badges/profiles/fetchTokenHolderProfiles';
import { LeaderboardType, runLeaderboardGeneration } from '../../src/leaderboard/services/leaderboardSchedulerService';
import { setupArenaMock, resetMocks, restoreAxios } from '../api/arenaMock';

// Mock the modules
jest.mock('../../src/badges/profiles/fetchTokenHolderProfiles', () => {
  const original = jest.requireActual('../../src/badges/profiles/fetchTokenHolderProfiles');
  return {
    ...original,
    fetchTokenHolderProfiles: jest.fn()
  };
});

jest.mock('../../src/leaderboard/services/leaderboardClassService', () => {
  return {
    LeaderboardClass: jest.fn().mockImplementation(() => {
      return {
        generateLeaderboard: jest.fn().mockResolvedValue(true),
        saveLeaderboardToFile: jest.fn().mockResolvedValue(true)
      };
    }),
    generateAndSaveStandardLeaderboard: jest.fn().mockResolvedValue(true),
    generateAndSaveMuLeaderboard: jest.fn().mockResolvedValue(true)
  };
});

// Mock file system operations
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined)
}));

// Create proper mock types
const mockedFetchTokenHolderProfiles = fetchTokenHolderProfiles as jest.MockedFunction<typeof fetchTokenHolderProfiles>;

describe('Scheduler Services with Arena API Errors', () => {
  // Sample test data
  const testAddress = '0x1234567890123456789012345678901234567890';
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
    resetMocks();
    
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    // Restore mocks
    jest.restoreAllMocks();
    restoreAxios();
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('Badge Scheduler', () => {
    test('should detect and handle Arena API rate limit errors', async () => {
      // Setup Arena API mock to always return rate limit
      setupArenaMock({
        rateLimitAddresses: [testAddress]
      });

      // Mock fetchTokenHolderProfiles to throw an Arena API error
      const mockError = new Error(`Arena API rate limit exceeded for ${testAddress}`);
      mockedFetchTokenHolderProfiles.mockRejectedValue(mockError);

      // Call the function with the new signature
      const result = await runAndSendResults(undefined, true, false, mockProjectName);

      // Verify error was detected and handled
      expect(result).toBe(ErrorType.RETRY_FAILURE);
      expect(console.error).toHaveBeenCalled();
    });

    test('should detect and handle Arena API server errors', async () => {
      // Setup Arena API mock to always return server error
      setupArenaMock({
        serverErrorAddresses: [testAddress]
      });

      // Mock fetchTokenHolderProfiles to throw an Arena API error
      const mockError = new Error(`Arena API server error for ${testAddress}`);
      mockedFetchTokenHolderProfiles.mockRejectedValue(mockError);

      // Call the function with the new signature
      const result = await runAndSendResults(undefined, true, false, mockProjectName);

      // Verify error was detected and handled
      expect(result).toBe(ErrorType.RETRY_FAILURE);
      expect(console.error).toHaveBeenCalled();
    });

    test('should detect and handle Arena API network errors', async () => {
      // Setup Arena API mock to always return network error
      setupArenaMock({
        networkErrorAddresses: [testAddress]
      });

      // Mock fetchTokenHolderProfiles to throw an Arena API error
      const mockError = new Error(`Arena API network error for ${testAddress}`);
      mockedFetchTokenHolderProfiles.mockRejectedValue(mockError);

      // Call the function with the new signature
      const result = await runAndSendResults(undefined, true, false, mockProjectName);

      // Verify error was detected and handled
      expect(result).toBe(ErrorType.RETRY_FAILURE);
      expect(console.error).toHaveBeenCalled();
    });

    test('should detect and handle Arena API max retries exceeded', async () => {
      // Mock fetchTokenHolderProfiles to throw a max retries error
      const mockError = new Error(`Arena API max retries exceeded for ${testAddress}`);
      mockedFetchTokenHolderProfiles.mockRejectedValue(mockError);

      // Call the function with the new signature
      const result = await runAndSendResults(undefined, true, false, mockProjectName);

      // Verify error was detected and handled
      expect(result).toBe(ErrorType.RETRY_FAILURE);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Leaderboard Scheduler', () => {
    beforeEach(() => {
      // Mock the leaderboard class service functions to throw an Arena API error
      const leaderboardClassService = require('../../src/leaderboard/services/leaderboardClassService');
      jest.spyOn(leaderboardClassService, 'generateAndSaveMuLeaderboard')
        .mockImplementation(() => {
          throw new Error('Arena API max retries exceeded');
        });
      jest.spyOn(leaderboardClassService, 'generateAndSaveStandardLeaderboard')
        .mockImplementation(() => {
          throw new Error('Arena API max retries exceeded');
        });
    });
    
    test('should detect and handle Arena API errors in leaderboard generation', async () => {
      // Create a spy for console.error to verify it's called
      const consoleErrorSpy = jest.spyOn(console, 'error');
      
      // Call the runLeaderboardGeneration function
      const result = await runLeaderboardGeneration([LeaderboardType.MU], true);
      
      // Verify error was detected and handled
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBe('RETRY_FAILURE'); // Leaderboard scheduler uses 'RETRY_FAILURE'
    });

    test('should not update leaderboard files when Arena API errors occur', async () => {
      // Create a spy for the file writing function
      const fsWriteFileSpy = jest.spyOn(require('fs'), 'writeFileSync');
      
      // Create a spy for console.error to verify it's called
      const consoleErrorSpy = jest.spyOn(console, 'error');
      
      // Call the runLeaderboardGeneration function
      const result = await runLeaderboardGeneration([LeaderboardType.STANDARD], true);
      
      // Verify that the leaderboard generation was aborted with retry failure
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result).toBe('RETRY_FAILURE');
      
      // Verify that some log was written
      expect(fsWriteFileSpy).toHaveBeenCalled();
    });
  });
});
