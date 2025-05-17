import axios from 'axios';
import { ArenabookUserResponse, StarsArenaUserResponse } from '../types/interfaces';
import { sleep } from '../utils/helpers';

// Constants
const ARENABOOK_API_URL = 'https://api.arena.trade/user_info';
const STARS_ARENA_API_URL = 'https://api.starsarena.com/user/handle';
const REQUEST_DELAY_MS = 500; // 500ms delay between requests
const MAX_RETRIES = 3;

/**
 * Generic function to make API requests with retry logic
 */
async function makeApiRequestWithRetry<T>(url: string, errorPrefix: string): Promise<T | null> {
  let retryCount = 0;
  
  while (retryCount <= MAX_RETRIES) {
    try {
      const response = await axios.get<T>(url);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          console.log(`No data found at ${url}`);
          // No need to retry for 404 errors
          return null;
        } else if (error.response.status === 429) {
          // Rate limit error - always propagate these
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Rate limit error fetching from ${url}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
            await sleep(REQUEST_DELAY_MS * 2); // Use longer delay for rate limits
          } else {
            const errorMsg = `${errorPrefix} rate limit exceeded after ${MAX_RETRIES} retries`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
        } else {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Error fetching from ${url} (${error.response.status}). Retry ${retryCount}/${MAX_RETRIES} after delay...`);
            await sleep(REQUEST_DELAY_MS);
          } else {
            const errorMsg = `${errorPrefix} error (${error.response.status}) after ${MAX_RETRIES} retries`;
            console.error(errorMsg, error.response.statusText);
            throw new Error(errorMsg);
          }
        }
      } else {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          console.log(`Unexpected error for ${url}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
          await sleep(REQUEST_DELAY_MS);
        } else {
          const errorMsg = `${errorPrefix} unexpected error after ${MAX_RETRIES} retries`;
          console.error(errorMsg, error);
          throw new Error(errorMsg);
        }
      }
    }
  }
  
  // This should never be reached, but just in case
  throw new Error(`${errorPrefix} max retries exceeded`);
}

/**
 * Fetch Twitter profile picture from Stars Arena API
 */
export async function fetchTwitterProfilePicture(twitterHandle: string): Promise<string | null> {
  if (!twitterHandle) return null;
  
  try {
    const data = await makeApiRequestWithRetry<StarsArenaUserResponse>(
      `${STARS_ARENA_API_URL}/?handle=${twitterHandle.toLowerCase()}`,
      'Stars Arena API'
    );
    
    if (data?.user?.twitterPicture) {
      return data.user.twitterPicture;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching Twitter profile picture for ${twitterHandle}:`, error);
    return null;
  }
}

/**
 * Fetch Arenabook social profile for a given address
 */
export async function fetchArenabookSocial(address: string): Promise<ArenabookUserResponse | null> {
  try {
    const data = await makeApiRequestWithRetry<ArenabookUserResponse[]>(
      `${ARENABOOK_API_URL}?user_address=eq.${address.toLowerCase()}`,
      'Arena API'
    );
    
    // The API returns an array, but we expect only one result for a specific address
    if (data && data.length > 0) {
      return data[0];
    }
    return null; // No profile found, but this is not an error
  } catch (error) {
    console.error(`Error fetching Arenabook profile for ${address}:`, error);
    throw error; // Propagate the error to be handled by the caller
  }
}
