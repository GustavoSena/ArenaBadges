import axios from 'axios';
import { ArenabookUserResponse, StarsArenaUserResponse, ArenaWalletResponse } from '../types/interfaces';
import { sleep } from '../utils/helpers';
import logger from '../utils/logger';
import { REQUEST_DELAY_MS_ARENA } from '../types/constants';

// Constants
const ARENA_API_URL = 'https://data.arena.trade/user-trades/user_by_address';
const STARS_ARENA_API_URL = 'https://api.starsarena.com/user/handle';
const MAX_RETRIES = 3;



/**
 * Generic function to make API requests with retry logic
 */
async function makeApiRequestWithRetry<T>(url: string, errorPrefix: string): Promise<T | null> {
  let retryCount = 0;
  
  while (retryCount <= MAX_RETRIES) {
    try {
      // Simple request with no authentication needed
      const response = await axios.get<T>(url, {
        headers: {
          'User-Agent': 'PostmanRuntime/7.44.1'
        }
      });
      
      // Log successful response
      logger.verboseLog(`Successful response from ${url}`);
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 429 || error.response.status === 504) {
          // Rate limit error - always propagate these
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            logger.log(`Rate limit error fetching from ${url}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
            await sleep(REQUEST_DELAY_MS_ARENA * 2); // Use longer delay for rate limits
          } else {
            const errorMsg = `${errorPrefix} rate limit exceeded after ${MAX_RETRIES} retries`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
          }
        } else {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            logger.log(`Error fetching from ${url} (${error.response.status}). Retry ${retryCount}/${MAX_RETRIES} after delay...`);
            await sleep(REQUEST_DELAY_MS_ARENA);
          } else {
            const errorMsg = `${errorPrefix} error (${error.response.status}) after ${MAX_RETRIES} retries`;
            logger.error(errorMsg, error.response.statusText);
            throw new Error(errorMsg);
          }
        }
      } else {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          logger.log(`Unexpected error for ${url}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
          await sleep(REQUEST_DELAY_MS_ARENA);
        } else {
          const errorMsg = `${errorPrefix} unexpected error after ${MAX_RETRIES} retries`;
          logger.error(errorMsg, error);
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
    logger.error(`Error fetching Twitter profile picture for ${twitterHandle}:`, error);
    throw error;
  }
}

/**
 * Fetch Arenabook social profile for a given address
 */
export async function fetchArenabookSocial(address: string): Promise<ArenabookUserResponse | null> {
  if (!address) throw new Error('Address is required');
  try {
    const data = await makeApiRequestWithRetry<ArenabookUserResponse>(
      `${ARENA_API_URL}/${address.toLowerCase()}`,
      'Arena API'
    );
    
    if (data) {
      // Extract only the two fields we care about
      // Use type assertion to access the full response properties
      const fullResponse = data as any;
      return {
        twitter_handle: fullResponse.twitter_handle_lc || fullResponse.twitter_handle, // Prefer lowercase version if available
        twitter_pfp_url: fullResponse.twitter_pfp_url
      };
    }
    
    return null;
  } catch (error) {
    // Rethrow the error with address information
    if (error instanceof Error) {
      throw new Error(`${error.message} for address ${address}`);
    }
    throw error;
  }
}

/**
 * Fetch a wallet address for a Twitter handle from the Stars Arena API
 * @param handle Twitter handle to lookup
 * @returns The wallet address and profile picture URL
 */
export async function fetchArenaAddressForHandle(handle: string): Promise<ArenaWalletResponse> {
  try {
    const data = await makeApiRequestWithRetry<StarsArenaUserResponse>(
      `${STARS_ARENA_API_URL}/?handle=${handle.toLowerCase()}`,
      'Stars Arena API'
    );
    
    if (data?.user?.dynamicAddress) {
      return { 
        address: data.user.dynamicAddress.toLowerCase(), 
        picture_url: data.user.twitterPicture || ''
      };
    }

    return { address: '', picture_url: '' };
  } catch (error) {
    // Log the error but don't throw it - this allows batch processing to continue
    logger.error(`Error fetching Arena address for handle ${handle}:`, error);
    return { address: '', picture_url: '' };
  }
}
