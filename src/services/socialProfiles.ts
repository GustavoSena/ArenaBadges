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
 * @param outputPath Path to save the output
 * @param processingName Name of the processing
 * @param transformFn Function to transform holder and social data
 * @param verbose Whether to show verbose logs
 * @returns Map of addresses to social info
 */
export async function processHoldersWithSocials<T extends { address: string }>(
  holders: T[],
  outputPath: string, // Kept for backward compatibility but not used for saving
  processingName: string,
  transformFn: (holder: T, social: ArenabookUserResponse | null) => any,
  verbose: boolean = false
): Promise<Map<string, SocialProfileInfo>> {
  console.log(`\nProcessing ${processingName}...`);
  
  const holdersWithSocials: any[] = [];
  let socialCount = 0;
  const addressToSocialInfo = new Map<string, SocialProfileInfo>();
  const batchSize = 10;
  
  if (verbose) console.log(`Processing ${holders.length} holders with socials in batches of ${batchSize}...`);
  
  for (let i = 0; i < holders.length; i += batchSize) {
    const batch = holders.slice(i, i + batchSize);
    const promises = batch.map(async (holder) => {
      if (verbose) console.log(`\n[${i + batch.indexOf(holder) + 1}/${holders.length}] Checking social profile for ${holder.address}...`);
      
      // Check if we already have this address's social profile
      let social: ArenabookUserResponse | null = null;
      
      if (addressToSocialInfo.has(holder.address.toLowerCase())) {
        const socialInfo = addressToSocialInfo.get(holder.address.toLowerCase());
        if (socialInfo?.twitter_handle) {
          social = { 
            twitter_handle: socialInfo.twitter_handle, 
            twitter_username: null,
            twitter_pfp_url: socialInfo.twitter_pfp_url
          };
          if (verbose) console.log(`Using cached Twitter handle: ${socialInfo.twitter_handle}`);
        } else {
          if (verbose) console.log(`Using cached result: No social profile found`);
        }
      } else {
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
      }
      
      const holderWithSocial = transformFn(holder, social);
      return holderWithSocial;
    });
    
    const batchResults = await Promise.all(promises);
    holdersWithSocials.push(...batchResults);
    
    // Log progress
    const holdersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
    if (verbose) console.log(`Processed ${i + Math.min(batchSize, holders.length - i)} of ${holders.length} addresses (${holdersWithTwitter.length} with Twitter handles)`);
    
    // Delay before next batch
    if (i + batchSize < holders.length) {
      await sleep(500);
    }
  }
  
  // Final processing
  const finalHoldersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
  
  // Log statistics
  if (verbose) console.log(`\nFinal statistics for ${processingName}:`);
  if (verbose) console.log(`Total holders processed: ${holders.length}`);
  if (verbose) console.log(`Holders with social profiles: ${socialCount}`);
  if (verbose) console.log(`Holders with Twitter handles: ${finalHoldersWithTwitter.length}`);
  else console.log(`Holders with social profiles: ${finalHoldersWithTwitter.length}`);
  
  return addressToSocialInfo;
}
