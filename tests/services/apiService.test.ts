import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { sendResultsToApi } from '../../src/services/apiService';

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
  
  test('should send data to API with correct payload', async () => {
    // Call the function
    await sendResultsToApi(mockApiKey);
    
    // Verify fs.readFileSync was called
    expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
    
    // Verify axios.post was called twice (once for each tier)
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    
    // Verify first call (Tier 1 - NFT holders)
    const tier1Call = mockedAxios.post.mock.calls[0];
    expect(tier1Call[0]).toContain('mu-tier-1');
    expect(tier1Call[0]).toContain(`key=${mockApiKey}`);
    expect(tier1Call[1]).toHaveProperty('handles', mockNftHolders.handles);
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
    expect(tier2Call[1]).toHaveProperty('handles', mockCombinedHolders.handles);
    expect(tier2Call[1]).toHaveProperty('timestamp');
    expect(tier2Call[2]).toEqual({
      headers: {
        'Content-Type': 'application/json'
      }
    });
  });
  
  test('should throw error when API key is not provided', async () => {
    // Call the function without an API key and expect it to throw
    await expect(sendResultsToApi(undefined)).rejects.toThrow('API key is required');
  });
  
  test('should handle API errors gracefully', async () => {
    // Mock axios.post to throw an error
    const mockError = new Error('API request failed');
    mockedAxios.post.mockRejectedValue(mockError);
    
    // Call the function and expect it to throw
    await expect(sendResultsToApi(mockApiKey)).rejects.toThrow();
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
  });
  
  test('should handle file reading errors gracefully', async () => {
    // Mock fs.readFileSync to throw an error
    const mockError = new Error('File not found');
    mockedFs.readFileSync.mockImplementation(() => {
      throw mockError;
    });
    
    // Call the function and expect it to throw
    await expect(sendResultsToApi(mockApiKey)).rejects.toThrow();
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
  });
});
