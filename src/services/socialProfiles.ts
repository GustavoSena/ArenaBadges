import { ArenabookUserResponse } from '../types/interfaces';
import { fetchArenabookSocial } from '../api/arenabook';
import { sleep } from '../utils/helpers';

/**
 * Process holders and fetch their social profiles
 */
export async function processHoldersWithSocials<T extends { address: string }>(
  holders: T[],
  outputPath: string, // Kept for backward compatibility but not used for saving
  processingName: string,
  transformFn: (holder: T, social: ArenabookUserResponse | null) => any
): Promise<Map<string, string | null>> {
  console.log(`\nProcessing ${processingName}...`);
  
  const holdersWithSocials: any[] = [];
  let socialCount = 0;
  const addressToTwitterHandle = new Map<string, string | null>();
  const batchSize = 10;
  
  for (let i = 0; i < holders.length; i += batchSize) {
    const batch = holders.slice(i, i + batchSize);
    const promises = batch.map(async (holder) => {
      console.log(`\n[${i + batch.indexOf(holder) + 1}/${holders.length}] Checking social profile for ${holder.address}...`);
      
      // Check if we already have this address's social profile
      let social: ArenabookUserResponse | null = null;
      
      if (addressToTwitterHandle.has(holder.address.toLowerCase())) {
        const twitterHandle = addressToTwitterHandle.get(holder.address.toLowerCase());
        if (twitterHandle) {
          social = { twitter_handle: twitterHandle, twitter_username: null };
          console.log(`Using cached Twitter handle: ${twitterHandle}`);
        } else {
          console.log(`Using cached result: No social profile found`);
        }
      } else {
        social = await fetchArenabookSocial(holder.address);
        
        if (social) {
          socialCount++;
          console.log(`Found Twitter handle: ${social.twitter_handle || 'None'}`);
        } else {
          console.log(`No social profile found`);
        }
        
        // Cache the result
        addressToTwitterHandle.set(holder.address.toLowerCase(), social?.twitter_handle || null);
      }
      
      const holderWithSocial = transformFn(holder, social);
      return holderWithSocial;
    });
    
    const batchResults = await Promise.all(promises);
    holdersWithSocials.push(...batchResults);
    
    // Log progress
    const holdersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
    console.log(`Processed ${i + Math.min(batchSize, holders.length - i)} of ${holders.length} addresses (${holdersWithTwitter.length} with Twitter handles)`);
    
    // Delay before next batch
    if (i + batchSize < holders.length) {
      await sleep(500);
    }
  }
  
  // Final processing
  const finalHoldersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
  
  // Log statistics
  console.log(`\nFinal statistics for ${processingName}:`);
  console.log(`Total holders processed: ${holders.length}`);
  console.log(`Holders with social profiles: ${socialCount}`);
  console.log(`Holders with Twitter handles: ${finalHoldersWithTwitter.length}`);
  
  return addressToTwitterHandle;
}
