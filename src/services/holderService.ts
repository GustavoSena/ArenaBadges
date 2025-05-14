import * as path from 'path';
import { TokenHolder, NftHolder, ArenabookUserResponse, HolderWithSocial, NftHolderWithSocial } from '../types/interfaces';
import { fetchTokenHoldersFromSnowtrace } from '../api/snowtrace';
import { fetchNftHoldersFromEthers } from '../api/blockchain';
import { processHoldersWithSocials, SocialProfileInfo } from './socialProfiles';
import { loadAppConfig } from '../utils/config';
import axios from 'axios';
import { formatTokenBalance } from '../utils/helpers';

export interface HolderResults {
  nftHolders: string[];
  combinedHolders: string[];
}

/**
 * Fetch token balance for a specific address
 */
async function fetchTokenBalanceForAddress(
  tokenAddress: string,
  holderAddress: string,
  tokenDecimals: number
): Promise<number> {
  try {
    // Construct the Snowtrace API URL for account token balance
    const apiUrl = `https://api.snowtrace.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${holderAddress}`;
    
    const response = await axios.get(apiUrl);
    
    if (response.data.status === '1' && response.data.result) {
      const balance = response.data.result;
      return formatTokenBalance(balance, tokenDecimals);
    }
    
    return 0;
  } catch (error) {
    console.error(`Error fetching token balance for address ${holderAddress}:`, error);
    return 0;
  }
}

/**
 * Fetch token balances for multiple addresses
 */
async function fetchTokenBalancesForAddresses(
  tokenAddress: string,
  tokenSymbol: string,
  holderAddresses: string[],
  tokenDecimals: number,
  minBalance: number = 0
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
  let processedCount = 0;
  
  console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses...`);
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < holderAddresses.length; i += batchSize) {
    const batch = holderAddresses.slice(i, i + batchSize);
    const batchPromises = batch.map(async (address) => {
      const balanceFormatted = await fetchTokenBalanceForAddress(tokenAddress, address, tokenDecimals);
      
      if (balanceFormatted >= minBalance) {
        return {
          address,
          balance: (balanceFormatted * Math.pow(10, tokenDecimals)).toString(),
          balanceFormatted,
          tokenSymbol
        };
      }
      return null;
    });
    
    const batchResults = await Promise.all(batchPromises);
    const validHolders = batchResults.filter(h => h !== null) as TokenHolder[];
    holders.push(...validHolders);
    
    processedCount += batch.length;
    if (processedCount % 20 === 0 || processedCount === holderAddresses.length) {
      console.log(`Processed ${processedCount}/${holderAddresses.length} addresses...`);
    }
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < holderAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`Found ${holders.length} addresses with ${tokenSymbol} balance >= ${minBalance}`);
  return holders;
}

/**
 * Main function to fetch token holders and their social profiles
 * New approach: First check NFT holders with social profiles, then fetch token balances only for those addresses
 */
export async function fetchTokenHolderProfiles(): Promise<HolderResults> {
  try {
    // Load configuration
    const config = loadAppConfig();
    
    // Get NFT config
    const nftConfig = config.nfts[0];
    
    console.log('Starting to fetch token holders and their social profiles with new approach...');
    console.log(`NFT to check: ${nftConfig.name} (${nftConfig.address}) (min balance: ${nftConfig.minBalance})`);
    
    // Step 1: Fetch NFT holders
    console.log('\nFetching NFT holders...');
    const nftHolders = await fetchNftHoldersFromEthers(
      nftConfig.address,
      nftConfig.name,
      nftConfig.minBalance
    );
    
    // Step 2: Get social profiles for NFT holders
    console.log('\nFetching social profiles for NFT holders...');
    const addressToSocialInfo = await processHoldersWithSocials<NftHolder>(
      nftHolders,
      '', // No need to specify path as we're not saving directly
      'NFT holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null,
        twitter_pfp_url: social?.twitter_pfp_url || null
      })
    );
    
    // Step 3: Filter NFT holders to only those with social profiles
    const nftHoldersWithSocial = nftHolders.filter(holder => {
      const socialInfo = addressToSocialInfo.get(holder.address.toLowerCase());
      return socialInfo && socialInfo.twitter_handle;
    });
    
    console.log(`\nFound ${nftHoldersWithSocial.length} NFT holders with social profiles`);
    
    // Step 4: For each token in config, fetch balances only for NFT holders with social profiles
    const holderResults: { [address: string]: { [token: string]: number } } = {};
    const holderAddresses = nftHoldersWithSocial.map(h => h.address.toLowerCase());
    
    // Initialize holder results
    for (const holder of nftHoldersWithSocial) {
      holderResults[holder.address.toLowerCase()] = {};
    }
    
    // Fetch token balances for each token
    for (const tokenConfig of config.tokens) {
      console.log(`\nFetching ${tokenConfig.symbol} balances for NFT holders with social profiles...`);
      
      const tokenHolders = await fetchTokenBalancesForAddresses(
        tokenConfig.address,
        tokenConfig.symbol,
        holderAddresses,
        tokenConfig.decimals,
        tokenConfig.minBalance
      );
      
      // Update holder results
      for (const holder of tokenHolders) {
        const address = holder.address.toLowerCase();
        if (holderResults[address]) {
          holderResults[address][tokenConfig.symbol] = holder.balanceFormatted;
        }
      }
    }
    
    // Step 5: Determine which holders have tokens (combined holders)
    const combinedHolders: string[] = [];
    const nftOnlyHolders: string[] = [];
    
    for (const holder of nftHoldersWithSocial) {
      const address = holder.address.toLowerCase();
      const socialInfo = addressToSocialInfo.get(address);
      
      if (!socialInfo || !socialInfo.twitter_handle) continue;
      
      const tokenBalances = holderResults[address];
      const hasAnyToken = Object.values(tokenBalances).some(balance => balance > 0);
      
      if (hasAnyToken) {
        combinedHolders.push(socialInfo.twitter_handle);
      } else {
        nftOnlyHolders.push(socialInfo.twitter_handle);
      }
    }
    
    console.log(`\nFinal results:`);
    console.log(`- NFT holders with social profiles: ${nftHoldersWithSocial.length}`);
    console.log(`- Holders with both NFTs and tokens: ${combinedHolders.length}`);
    console.log(`- Holders with only NFTs: ${nftOnlyHolders.length}`);
    
    // Return the results
    return {
      nftHolders: nftOnlyHolders,
      combinedHolders: combinedHolders
    };
    
  } catch (error) {
    console.error('Error in fetchTokenHolderProfiles:', error);
    throw error; // Re-throw to allow caller to handle
  }
}
