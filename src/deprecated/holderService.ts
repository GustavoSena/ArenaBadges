import * as path from 'path';
import { TokenHolder, NftHolder, ArenabookUserResponse, HolderWithSocial, NftHolderWithSocial } from '../types/interfaces';
import { fetchTokenHoldersFromSnowtrace } from '../api/snowtrace';
import { fetchNftHoldersFromEthers } from '../api/blockchain';
import { processHoldersWithSocials, SocialProfileInfo } from '../services/socialProfiles';
import { loadConfig } from '../utils/helpers';

export interface HolderResults {
  nftHolders: string[];
  combinedHolders: string[];
}

/**
 * Main function to fetch token holders and their social profiles
 * Returns the Twitter handles for both NFT-only holders and combined holders
 */
export async function fetchTokenHolderProfiles(): Promise<HolderResults> {
  try {
    // Load configuration
    const config = loadConfig();
    
    // Get the first token and NFT from config
    const tokenConfig = config.tokens[0];
    const nftConfig = config.nfts[0];
    
    console.log('Starting to fetch token holders and their social profiles...');
    console.log(`Token address to check: ${tokenConfig.symbol} (${tokenConfig.address}) (min balance: ${tokenConfig.minBalance})`);
    console.log(`NFT to check: ${nftConfig.name} (${nftConfig.address}) (min balance: ${nftConfig.minBalance})`);
    
    // Fetch token holders
    console.log('\nFetching token holders...');
    const tokenHolders = await fetchTokenHoldersFromSnowtrace(
      tokenConfig.address,
      tokenConfig.symbol,
      tokenConfig.minBalance,
      tokenConfig.decimals
    );
    
    // Fetch NFT holders
    console.log('\nFetching NFT holders...');
    const nftHolders = await fetchNftHoldersFromEthers(
      nftConfig.address,
      nftConfig.name,
      nftConfig.minBalance
    );
    
    // Find addresses that have both tokens and NFTs
    console.log("\nFinding holders with both tokens and NFTs...");
    const tokenAddresses = new Set(tokenHolders.map(h => h.address.toLowerCase()));
    const nftAddresses = new Set(nftHolders.map(h => h.address.toLowerCase()));
    
    const combinedAddresses = [...nftAddresses].filter(address => tokenAddresses.has(address));
    console.log(`Found ${combinedAddresses.length} addresses that hold both tokens and NFTs`);
    
    // Create a set of combined addresses for faster lookups
    const combinedAddressesSet = new Set(combinedAddresses);
    
    // Process combined holders first
    console.log('\nProcessing combined holders (MUV + NFT)...');
    const combinedNftHolders = nftHolders.filter(holder => 
      combinedAddressesSet.has(holder.address.toLowerCase())
    );
    
    const combinedAddressToTwitter = await processHoldersWithSocials<NftHolder>(
      combinedNftHolders,
      '', // No need to specify path as we're not saving directly
      'combined holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null,
        twitter_pfp_url: social?.twitter_pfp_url || null
      })
    );
    
    // Get the Twitter handles from the combined holders
    const combinedHandles = Array.from(combinedAddressToTwitter.values())
      .filter(info => info && info.twitter_handle)
      .map(info => info.twitter_handle) as string[];
    
    console.log(`\nFound ${combinedHandles.length} Twitter handles of holders with both tokens and NFTs`);
    
    // Filter NFT holders to exclude those in the combined list
    console.log('\nProcessing exclusive NFT holders (NFT only)...');
    const exclusiveNftHolders = nftHolders.filter(holder => 
      !combinedAddressesSet.has(holder.address.toLowerCase())
    );
    console.log(`Found ${exclusiveNftHolders.length} addresses that hold only NFTs (excluding combined holders)`);
    
    // Process exclusive NFT holders
    const nftAddressToTwitter = await processHoldersWithSocials<NftHolder>(
      exclusiveNftHolders,
      '', // No need to specify path as we're not saving directly
      'exclusive NFT holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null,
        twitter_pfp_url: social?.twitter_pfp_url || null
      })
    );
    
    // Get the Twitter handles from the exclusive NFT holders
    const nftHandles = Array.from(nftAddressToTwitter.values())
      .filter(info => info && info.twitter_handle)
      .map(info => info.twitter_handle) as string[];
    
    console.log(`\nFound ${nftHandles.length} Twitter handles of exclusive NFT holders`);
    
    // Return the results
    return {
      nftHolders: nftHandles,
      combinedHolders: combinedHandles
    };
    
  } catch (error) {
    console.error('Error in fetchTokenHolderProfiles:', error);
    throw error; // Re-throw to allow caller to handle
  }
}
