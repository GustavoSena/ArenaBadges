import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { sendResultsToApi } from '../../src/services/apiService';
import { HolderResults } from '../../src/services/holderService';

// Mock the modules
jest.mock('axios');
jest.mock('fs');
jest.mock('path');

// Create proper mock types
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;

describe('apiService', () => {
  // Setup test data
  const mockNftHolders = { handles: ['user1', 'user2', 'user3'] };
  const mockCombinedHolders = { handles: ['user4', 'user5'] };
  const mockApiKey = 'test-api-key';
  
  // Mock holder results
  const mockResults: HolderResults = {
    nftHolders: ['user1', 'user2', 'user3'],
    combinedHolders: ['user4', 'user5']
  };
  
  // Mock file paths
  const mockNftPath = '/mocked/path/to/nft_holders.json';
  const mockCombinedPath = '/mocked/path/to/combined_holders.json';
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock path.join to return our mock paths
    mockedPath.join.mockImplementation((dir, relativePath) => {
      if (relativePath && relativePath.includes('nft_holders.json')) {
        return mockNftPath;
      }
      return mockCombinedPath;
    });
    
    // Mock fs.existsSync to return false (no previous files)
    mockedFs.existsSync.mockReturnValue(false);
    
    // Mock fs.readFileSync to return our test data
    mockedFs.readFileSync.mockImplementation((path, options) => {
      // Default to combined holders if path is undefined or can't be determined
      return JSON.stringify(path === mockNftPath ? mockNftHolders : mockCombinedHolders);
    });
    
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
  
  test('should send data to API with correct payload when no previous files exist', async () => {
    // Call the function
    await sendResultsToApi(mockApiKey, mockResults);
    
    // Verify fs.existsSync was called
    expect(mockedFs.existsSync).toHaveBeenCalledTimes(2);
    
    // Verify axios.post was called twice (once for each tier)
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    
    // Verify first call (Tier 1 - NFT holders)
    const tier1Call = mockedAxios.post.mock.calls[0];
    expect(tier1Call[0]).toContain('mu-tier-1');
    expect(tier1Call[0]).toContain(`key=${mockApiKey}`);
    expect(tier1Call[1]).toHaveProperty('handles', mockResults.nftHolders);
    expect(tier1Call[1]).toHaveProperty('timestamp');
    expect(tier1Call[2]).toEqual({
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Verify second call (Tier 2 - Combined holders)
    const tier2Call = mockedAxios.post.mock.calls[1];
    expect(tier2Call[0]).toContain('mu-tier-2');
    expect(tier2Call[0]).toContain(`key=${mockApiKey}`);
    expect(tier2Call[1]).toHaveProperty('handles', mockResults.combinedHolders);
    expect(tier2Call[1]).toHaveProperty('timestamp');
    expect(tier2Call[2]).toEqual({
      headers: {
        'Content-Type': 'application/json'
      }
    });
  });
  
  test('should not send data to API when results are unchanged', async () => {
    // Mock fs.existsSync to return true (previous files exist)
    mockedFs.existsSync.mockReturnValue(true);
    
    // Mock fs.readFileSync to return the same data as current results
    mockedFs.readFileSync.mockImplementation((path, options) => {
      if (String(path).includes('nft_holders.json')) {
        return JSON.stringify({ handles: mockResults.nftHolders });
      }
      return JSON.stringify({ handles: mockResults.combinedHolders });
    });
    
    // Call the function
    const result = await sendResultsToApi(mockApiKey, mockResults);
    
    // Verify result is null (no changes)
    expect(result).toBeNull();
    
    // Verify axios.post was not called
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  
  test('should throw error when API key is not provided', async () => {
    // Call the function without an API key and expect it to throw
    await expect(sendResultsToApi(undefined, mockResults)).rejects.toThrow('API key is required');
  });
  
  test('should handle API errors gracefully', async () => {
    // Mock axios.post to throw an error
    const mockError = new Error('API request failed');
    mockedAxios.post.mockRejectedValue(mockError);
    
    // Call the function and expect it to throw
    await expect(sendResultsToApi(mockApiKey, mockResults)).rejects.toThrow();
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
  });
  
  test('should handle file reading errors gracefully', async () => {
    // Mock fs.existsSync to return true (previous files exist)
    mockedFs.existsSync.mockReturnValue(true);
    
    // Mock fs.readFileSync to throw an error
    const mockError = new Error('File not found');
    mockedFs.readFileSync.mockImplementation(() => {
      throw mockError;
    });
    
    // Call the function
    await sendResultsToApi(mockApiKey, mockResults);
    
    // Verify axios.post was called (should assume changes when error occurs)
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
  });
});
