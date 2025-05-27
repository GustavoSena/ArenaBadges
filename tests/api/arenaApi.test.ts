import { fetchArenabookSocial } from '../../src/api/arenabook';
import { setupArenaMock, resetMocks, restoreAxios } from './arenaMock';
import { ArenabookUserResponse } from '../../src/types/interfaces';

describe.skip('Arena API Client', () => {
  // Sample test data
  const testAddress = '0x1234567890123456789012345678901234567890';
  const mockUserResponse: ArenabookUserResponse = {
    twitter_handle: 'test_user',
    twitter_pfp_url: 'https://example.com/avatar.jpg'
  };

  beforeEach(() => {
    // Reset mocks before each test
    resetMocks();
  });

  afterAll(() => {
    // Restore axios to its original state after all tests
    restoreAxios();
  });

  test('should successfully fetch a user profile', async () => {
    // Setup mock to return a successful response
    setupArenaMock({
      successResponses: {
        [testAddress]: mockUserResponse
      }
    });

    // Call the function
    const result = await fetchArenabookSocial(testAddress);

    // Verify the result
    expect(result).toEqual(mockUserResponse);
  });

  test('should return null for non-existent profiles', async () => {
    // Setup mock to return an empty array (no profile found)
    setupArenaMock({
      notFoundAddresses: [testAddress]
    });

    // Call the function
    const result = await fetchArenabookSocial(testAddress);

    // Verify the result
    expect(result).toBeNull();
  });

  test('should throw error on rate limit (429)', async () => {
    // Setup mock to return a rate limit response
    setupArenaMock({
      rateLimitAddresses: [testAddress]
    });

    // Call the function and expect it to throw
    await expect(fetchArenabookSocial(testAddress)).rejects.toThrow(/rate limit exceeded/i);
  }, 10000); // Increase timeout to 10 seconds

  test('should retry on rate limit and eventually succeed', async () => {
    // Create a custom mock that returns rate limit first, then success
    const mock = setupArenaMock({});
    
    let requestCount = 0;
    
    mock.onGet(new RegExp(`user_info\\?user_address=eq\\.${testAddress.toLowerCase()}`))
      .reply(() => {
        requestCount++;
        // First request: rate limit
        if (requestCount === 1) {
          return [429, { error: 'Too many requests' }];
        }
        // Second request: rate limit again
        if (requestCount === 2) {
          return [429, { error: 'Too many requests' }];
        }
        // Third request: success
        return [200, [mockUserResponse]];
      });

    // Call the function
    const result = await fetchArenabookSocial(testAddress);

    // Verify the result
    expect(result).toEqual(mockUserResponse);
    expect(requestCount).toBe(3); // Initial request + 2 retries (the 3rd attempt succeeds)
  });

  test('should throw error after max retries on rate limit', async () => {
    // Setup mock to always return rate limit
    setupArenaMock({
      rateLimitAddresses: [testAddress]
    });

    // Call the function and expect it to throw with rate limit message
    await expect(fetchArenabookSocial(testAddress)).rejects.toThrow(/rate limit exceeded/i);
  }, 10000); // Increase timeout to 10 seconds

  test('should throw error on server error (500)', async () => {
    // Setup mock to return a server error
    setupArenaMock({
      serverErrorAddresses: [testAddress]
    });

    // Call the function and expect it to throw
    await expect(fetchArenabookSocial(testAddress)).rejects.toThrow(/API error \(500\)/i);
  });

  test('should throw error on network error', async () => {
    // Setup mock to return a network error
    setupArenaMock({
      networkErrorAddresses: [testAddress]
    });

    // Call the function and expect it to throw
    await expect(fetchArenabookSocial(testAddress)).rejects.toThrow(/unexpected error/i);
  });

  test('should include address in error message', async () => {
    // Setup mock to return a server error
    setupArenaMock({
      serverErrorAddresses: [testAddress]
    });

    // Call the function and expect it to throw with address in message
    await expect(fetchArenabookSocial(testAddress)).rejects.toThrow(testAddress);
  });
});
