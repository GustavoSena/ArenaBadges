import { ArenabookUserResponse } from '../types/interfaces';
import { fetchArenabookSocial } from '../api/arenabook';
import { sleep } from '../utils/helpers';

/**
 * Social profile information returned by processHoldersWithSocials
 */
export interface SocialProfileInfo {
  twitter_handle: string | null;
  twitter_pfp_url: string | null;
}

/**
 * Process holders with socials
 * @param holders Array of holders
 * @param transformFn Function to transform holder and social data
 * @param walletMappingParam Optional wallet mapping to use for Twitter handles
 * @param onlyIncludeArenaProfiles No longer used
 * @param verbose Whether to show verbose logs
 * @returns Map of addresses to social info
 */
export async function processHoldersWithSocials<T extends { address: string }>(
  holders: T[],
  transformFn: (holder: T, social: ArenabookUserResponse | null) => any,
  walletMappingParam?: Record<string, string>,
  verbose: boolean = false
): Promise<Map<string, SocialProfileInfo>> {
  console.log(`\nProcessing holders with socials...`);
  
  const holdersWithSocials: any[] = [];
  let socialCount = 0;
  const addressToSocialInfo = new Map<string, SocialProfileInfo>();
  const batchSize = 10;
  
  // Track if we've encountered any Arena API errors
  let hasArenaApiError = false;
  
  if (verbose) console.log(`Processing ${holders.length} holders with socials in batches of ${batchSize}...`);
  
  for (let i = 0; i < holders.length; i += batchSize) {
    // If we've already encountered an Arena API error, don't process more batches
    if (hasArenaApiError) {
      if (verbose) console.error('Skipping remaining batches due to previous Arena API errors');
      break;
    }
    
    const batch = holders.slice(i, i + batchSize);
    const batchPromises = [];
    
    for (const holder of batch) {
      batchPromises.push((async () => {
        try {
          if (verbose) console.log(`\n[${i + batch.indexOf(holder) + 1}/${holders.length}] Checking social profile for ${holder.address}...`);
          
          // Check if we already have this address's social profile
          let social: ArenabookUserResponse | null = null;
          
          // First check if this address is in the wallet mapping
          if (walletMappingParam && walletMappingParam[holder.address.toLowerCase()]) {
            const twitterHandle = walletMappingParam[holder.address.toLowerCase()];
            social = { twitter_handle: twitterHandle, twitter_pfp_url: null };
            if (verbose) console.log(`Found Twitter handle in wallet mapping: ${twitterHandle}`);
            // Add to the address to social info map
            addressToSocialInfo.set(holder.address.toLowerCase(), {
              twitter_handle: twitterHandle,
              twitter_pfp_url: null
            });
          }
          // If not in wallet mapping, check if we already have this address's social profile
          else if (addressToSocialInfo.has(holder.address.toLowerCase())) {
            const socialInfo = addressToSocialInfo.get(holder.address.toLowerCase());
            if (socialInfo?.twitter_handle) {
              social = { 
                twitter_handle: socialInfo.twitter_handle, 
                twitter_pfp_url: socialInfo.twitter_pfp_url
              };
              if (verbose) console.log(`Using cached Twitter handle: ${socialInfo.twitter_handle}`);
            } else {
              if (verbose) console.log(`Using cached result: No social profile found`);
            }
          } else {
            try {
              social = await fetchArenabookSocial(holder.address);
              
              if (social) {
                socialCount++;
                if (verbose) console.log(`Found Twitter handle: ${social.twitter_handle || 'None'}`);
                
                // Cache the result
                addressToSocialInfo.set(holder.address.toLowerCase(), {
                  twitter_handle: social.twitter_handle,
                  twitter_pfp_url: social.twitter_pfp_url
                });
              } else {
                if (verbose) console.log(`No social profile found`);
                
                // Cache the empty result
                addressToSocialInfo.set(holder.address.toLowerCase(), {
                  twitter_handle: null,
                  twitter_pfp_url: null
                });
              }
            } catch (error) {
              // If this is an Arena API error, propagate it to stop the entire process
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (errorMessage.includes('Arena API') || errorMessage.includes('rate limit')) {
                console.error(`Arena API error fetching social profile for ${holder.address}:`, errorMessage);
                hasArenaApiError = true;
                throw error;
              }
              
              // For other errors, log and continue
              console.error(`Error fetching social profile for ${holder.address}:`, error);
              
              // Cache the empty result
              addressToSocialInfo.set(holder.address.toLowerCase(), {
                twitter_handle: null,
                twitter_pfp_url: null
              });
            }
          }
          
          const holderWithSocial = transformFn(holder, social);
          return holderWithSocial;
        } catch (error) {
          // Rethrow Arena API errors to stop the entire process
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Arena API') || errorMessage.includes('rate limit')) {
            throw error;
          }
          // For other errors, log and continue
          console.error(`Error processing holder ${holder.address}:`, error);
          return transformFn(holder, null);
        }
      })());
    }
    
    try {
      const batchResults = await Promise.all(batchPromises);
      holdersWithSocials.push(...batchResults);
    } catch (error) {
      // If we get an Arena API error, propagate it
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Arena API') || errorMessage.includes('rate limit')) {
        console.error('Arena API error detected during batch processing. Aborting further processing.');
        hasArenaApiError = true;
        throw new Error(`Arena API error during batch processing: ${errorMessage}`);
      }
      // For other errors, log and continue with the next batch
      console.error('Error processing batch:', error);
    }
    
    // Log progress
    const holdersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
    if (verbose) console.log(`Processed ${i + Math.min(batchSize, holders.length - i)} of ${holders.length} addresses (${holdersWithTwitter.length} with Twitter handles)`);
    
    // Delay before next batch
    if (i + batchSize < holders.length) {
      await sleep(500);
    }
  }
  
  // Log statistics
  const holdersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
  if (verbose) console.log(`\nFinal statistics:`);
  if (verbose) console.log(`Total holders processed: ${holders.length}`);
  if (verbose) console.log(`Holders with social profiles: ${socialCount}`);
  if (verbose) console.log(`Holders with Twitter handles: ${holdersWithTwitter.length}`);
  else console.log(`Holders with social profiles: ${holdersWithTwitter.length}`);
  
  return addressToSocialInfo;
}
