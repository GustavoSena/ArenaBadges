// Arena API Mock for testing
import axios from 'axios';
import { ArenabookUserResponse } from '../../src/types/interfaces';

// Mock adapter for axios
import MockAdapter from 'axios-mock-adapter';

// Create a new instance of the axios mock adapter
const mock = new MockAdapter(axios);

/**
 * Setup mock responses for Arena API
 * @param options Configuration options for the mock
 */
export function setupArenaMock(options: {
  successResponses?: { [address: string]: ArenabookUserResponse },
  notFoundAddresses?: string[],
  rateLimitAddresses?: string[],
  serverErrorAddresses?: string[],
  networkErrorAddresses?: string[],
  delayMs?: number
}) {
  // Reset previous mocks
  mock.reset();
  
  const {
    successResponses = {},
    notFoundAddresses = [],
    rateLimitAddresses = [],
    serverErrorAddresses = [],
    networkErrorAddresses = [],
    delayMs = 0
  } = options;
  
  // Setup success responses
  Object.entries(successResponses).forEach(([address, response]) => {
    mock.onGet(new RegExp(`user_info\\?user_address=eq\\.${address.toLowerCase()}`))
      .reply(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve([200, [response]]);
          }, delayMs);
        });
      });
  });
  
  // Setup not found responses (empty array, status 200)
  notFoundAddresses.forEach(address => {
    mock.onGet(new RegExp(`user_info\\?user_address=eq\\.${address.toLowerCase()}`))
      .reply(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve([200, []]);
          }, delayMs);
        });
      });
  });
  
  // Setup rate limit responses (status 429)
  rateLimitAddresses.forEach(address => {
    mock.onGet(new RegExp(`user_info\\?user_address=eq\\.${address.toLowerCase()}`))
      .reply(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve([429, { error: 'Too many requests' }]);
          }, delayMs);
        });
      });
  });
  
  // Setup server error responses (status 500)
  serverErrorAddresses.forEach(address => {
    mock.onGet(new RegExp(`user_info\\?user_address=eq\\.${address.toLowerCase()}`))
      .reply(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve([500, { error: 'Internal server error' }]);
          }, delayMs);
        });
      });
  });
  
  // Setup network error responses
  networkErrorAddresses.forEach(address => {
    mock.onGet(new RegExp(`user_info\\?user_address=eq\\.${address.toLowerCase()}`))
      .networkError();
  });
  
  return mock;
}

/**
 * Reset all mocks
 */
export function resetMocks() {
  mock.reset();
}

/**
 * Restore axios to its original state
 */
export function restoreAxios() {
  mock.restore();
}
