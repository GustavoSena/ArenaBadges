import axios from 'axios';
import { ArenabookUserResponse } from '../types/interfaces';
import { sleep } from '../utils/helpers';

// Constants
const ARENABOOK_API_URL = 'https://api.arenabook.xyz/user_info';
const REQUEST_DELAY_MS = 500; // 500ms delay between requests

/**
 * Fetch Arenabook social profile for a given address
 */
export async function fetchArenabookSocial(address: string): Promise<ArenabookUserResponse | null> {
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  while (retryCount <= MAX_RETRIES) {
    try {
      const response = await axios.get<ArenabookUserResponse[]>(`${ARENABOOK_API_URL}?user_address=eq.${address.toLowerCase()}`);

      // The API returns an array, but we expect only one result for a specific address
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          console.log(`No social profile found for ${address}`);
          // No need to retry for 404 errors
          return null;
        } else {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Error fetching Arenabook profile for ${address} (${error.response.status}). Retry ${retryCount}/${MAX_RETRIES} after delay...`);
            await sleep(REQUEST_DELAY_MS);
          } else {
            console.error(`Failed after ${MAX_RETRIES} retries for ${address}:`, error.response.status, error.response.statusText);
            return null;
          }
        }
      } else {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          console.log(`Unexpected error for ${address}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
          await sleep(REQUEST_DELAY_MS);
        } else {
          console.error(`Failed after ${MAX_RETRIES} retries for ${address}:`, error);
          return null;
        }
      }
    }
  }
  
  return null;
}
