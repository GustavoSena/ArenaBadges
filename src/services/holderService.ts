import * as path from 'path';
import { TokenHolder, NftHolder, ArenabookUserResponse, HolderWithSocial, NftHolderWithSocial } from '../types/interfaces';
import { fetchTokenHoldersFromSnowtrace } from '../api/snowtrace';
import { fetchNftHoldersFromEthers } from '../api/blockchain';
import { processHoldersWithSocials } from './socialProfiles';
import { loadConfig, ensureOutputDirectory, saveToJsonFile } from '../utils/helpers';

// File paths
const NFT_HOLDERS_PATH = path.join(__dirname, '../../files/nft_holders.json');
const COMBINED_HOLDERS_PATH = path.join(__dirname, '../../files/combined_holders.json');

/**
 * Main function to fetch token holders and their social profiles
 */
export async function fetchTokenHolderProfiles(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();
    
    // Get the first token and NFT from config
    const tokenConfig = config.tokens[0];
    const nftConfig = config.nfts[0];
    
    console.log('Starting to fetch token holders and their social profiles...');
    console.log(`Token address to check: ${tokenConfig.symbol} (${tokenConfig.address}) (min balance: ${tokenConfig.minBalance})`);
    console.log(`NFT to check: ${nftConfig.name} (${nftConfig.address}) (min balance: ${nftConfig.minBalance})`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(NFT_HOLDERS_PATH);
    ensureOutputDirectory(outputDir);
    
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
      COMBINED_HOLDERS_PATH,
      'combined holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null
      } as NftHolderWithSocial)
    );
    
    // Get the Twitter handles from the combined holders
    const combinedHandles = Array.from(combinedAddressToTwitter.values())
      .filter(handle => handle !== null && handle !== undefined) as string[];
    
    // Save combined results
    const combinedOutputData = { handles: combinedHandles };
    saveToJsonFile(COMBINED_HOLDERS_PATH, combinedOutputData);
    console.log(`\nSaved ${combinedHandles.length} Twitter handles of holders with both tokens and NFTs`);
    
    // Filter NFT holders to exclude those in the combined list
    console.log('\nProcessing exclusive NFT holders (NFT only)...');
    const exclusiveNftHolders = nftHolders.filter(holder => 
      !combinedAddressesSet.has(holder.address.toLowerCase())
    );
    console.log(`Found ${exclusiveNftHolders.length} addresses that hold only NFTs (excluding combined holders)`);
    
    // Process exclusive NFT holders
    const nftAddressToTwitter = await processHoldersWithSocials<NftHolder>(
      exclusiveNftHolders,
      NFT_HOLDERS_PATH,
      'exclusive NFT holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null
      } as NftHolderWithSocial)
    );
    
    // Get the Twitter handles from the exclusive NFT holders
    const nftHandles = Array.from(nftAddressToTwitter.values())
      .filter(handle => handle !== null && handle !== undefined) as string[];
    
    // Save NFT results
    const nftOutputData = { handles: nftHandles };
    saveToJsonFile(NFT_HOLDERS_PATH, nftOutputData);
    console.log(`\nSaved ${nftHandles.length} Twitter handles of exclusive NFT holders`);
    
  } catch (error) {
    console.error('Error in fetchTokenHolderProfiles:', error);
  }
}
