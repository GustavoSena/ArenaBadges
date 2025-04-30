// Token Holder Profiles Fetcher
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import axios from 'axios';
import { sleep as sleepUtil } from '../../utils/helpers';
import { TokenHolder, NftHolder } from '../../types/interfaces';
import { SocialProfileInfo } from '../../services/socialProfiles';

// Load environment variables
dotenv.config();

// Export the HolderResults interface for use in other files
export interface HolderResults {
  nftHolders: string[];
  combinedHolders: string[];
}

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/tokens.json'), 'utf8'));

// Define config interfaces
interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  minBalance: number;
}

interface NftConfig {
  address: string;
  name: string;
  minBalance: number;
}

interface AppConfig {
  tokens: TokenConfig[];
  nfts: NftConfig[];
}

// Type assertion for config
const typedConfig = config as AppConfig;

// Define types
interface ArenabookUserResponse {
  twitter_username: string | null;
  twitter_handle: string | null;
}

interface HolderWithSocial extends TokenHolder {
  twitter_handle: string | null;
}

interface NftHolderWithSocial extends NftHolder {
  twitter_handle: string | null;
}

// File paths
const NFT_HOLDERS_PATH = path.join(__dirname, '../files/nft_holders.json');
const COMBINED_HOLDERS_PATH = path.join(__dirname, '../files/combined_holders.json');

// Constants
const ARENABOOK_API_URL = 'https://api.arenabook.xyz/user_info';
const REQUEST_DELAY_MS = 500; // 500ms delay between requests

// Create mappings from configuration
const MIN_TOKEN_BALANCES: { [key: string]: number } = {};
const TOKEN_SYMBOLS: { [key: string]: string } = {};
const TOKEN_DECIMALS: { [key: string]: number } = {};

// Initialize token mappings from config
typedConfig.tokens.forEach((token: TokenConfig) => {
  const lowerAddress = token.address.toLowerCase();
  MIN_TOKEN_BALANCES[lowerAddress] = token.minBalance;
  TOKEN_SYMBOLS[lowerAddress] = token.symbol;
  TOKEN_DECIMALS[lowerAddress] = token.decimals;
});

// Get the first NFT from config
const NFT_CONFIG = typedConfig.nfts[0];
const NFT_CONTRACT = NFT_CONFIG.address;
const NFT_NAME = NFT_CONFIG.name;
const MIN_NFT_BALANCE = NFT_CONFIG.minBalance;

// Get API keys from .env
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

if (!SNOWTRACE_API_KEY) {
  console.warn('SNOWTRACE_API_KEY not found in .env file. Will use API without key (rate limited).');
}

if (!ALCHEMY_API_KEY) {
  console.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching NFT holders.');
}

// Setup ethers provider
const rpcProvider = "https://avax-mainnet.g.alchemy.com/v2/" + ALCHEMY_API_KEY;
const provider = new ethers.JsonRpcProvider(rpcProvider);

// ERC-721 ABI (minimal for balanceOf and ownerOf functions)
const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)"
];

/**
 * Sleep function to introduce delay between API requests
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format token balance with proper decimals
 */
function formatTokenBalance(balance: string, tokenAddress: string): number {
  const decimals = TOKEN_DECIMALS[tokenAddress.toLowerCase()] || 18;
  return parseFloat(ethers.formatUnits(balance, decimals));
}

/**
 * Fetch token holders using Snowtrace API
 */
async function fetchTokenHoldersFromSnowtrace(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    console.log(`Fetching holders for ${TOKEN_SYMBOLS[tokenAddress.toLowerCase()]} (${tokenAddress}) from Snowtrace...`);
    
    const holders: TokenHolder[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMorePages = true;
    
    while (hasMorePages) {
      console.log(`Fetching page ${page} of token holders...`);
      
      // Construct the Snowtrace API URL
      const apiUrl = `https://api.snowtrace.io/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=${page}&offset=${pageSize}${SNOWTRACE_API_KEY ? `&apikey=${SNOWTRACE_API_KEY}` : ''}`;
      
      try {
        const response = await axios.get(apiUrl);
        
        if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
          const holdersData = response.data.result;
          
          // Process each holder
          for (const holderData of holdersData) {
            const address = holderData.TokenHolderAddress;
            const balance = holderData.TokenHolderQuantity;
            const balanceFormatted = formatTokenBalance(balance, tokenAddress);
            
            // Only include holders with balance > MIN_TOKEN_BALANCE
            if (balanceFormatted >= MIN_TOKEN_BALANCES[tokenAddress.toLowerCase()]) {
              holders.push({
                address,
                balance,
                balanceFormatted,
                tokenSymbol: TOKEN_SYMBOLS[tokenAddress.toLowerCase()]
              });
            }
          }
          
          // Check if we should fetch more pages
          if (holdersData.length < pageSize) {
            hasMorePages = false;
          } else {
            page++;
            // Add delay between pages to avoid rate limiting
            await sleepUtil(1000);
          }
        } else {
          hasMorePages = false;
        }
      } catch (error) {
        console.error(`Error fetching token holders page ${page}:`, error);
        hasMorePages = false;
      }
    }
    
    // Sort holders by balance (descending)
    holders.sort((a, b) => b.balanceFormatted - a.balanceFormatted);
    
    console.log(`Found ${holders.length} holders with balance > ${MIN_TOKEN_BALANCES[tokenAddress.toLowerCase()]} ${TOKEN_SYMBOLS[tokenAddress.toLowerCase()]}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching token holders for ${tokenAddress}:`, error);
    return [];
  }
}

/**
 * Fetch NFT holders using ethers.js and Alchemy provider
 */
async function fetchNftHoldersFromEthers(nftAddress: string): Promise<NftHolder[]> {
  try {
    console.log(`Fetching holders for ${NFT_NAME} (${nftAddress}) using ethers.js...`);
    
    // Create contract instance
    const nftContract = new ethers.Contract(nftAddress, ERC721_ABI, provider);
    
    // Track NFT holders and their token counts
    const holderCounts = new Map<string, number>();
    
    // Start checking token IDs from 0
    console.log("Checking token owners sequentially...");
    
    // Process tokens in batches to avoid rate limiting
    const batchSize = 25;
    let invalidTokenCount = 0;
    const maxInvalidTokens = 5; // Stop after encountering this many invalid tokens in a row
    
    for (let i = 0; ; i += batchSize) {
      const promises = [];
      for (let j = 0; j < batchSize; j++) {
        const tokenId = i + j;
        promises.push(
          (async () => {
            try {
              const owner = await nftContract.ownerOf(tokenId);
              return { tokenId, owner: owner.toLowerCase(), valid: true };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              const isInvalidTokenId = errorMessage.includes("invalid token ID");
              console.log(`Token ${tokenId}: ${isInvalidTokenId ? "Invalid token ID" : "Error: " + errorMessage}`);
              return { tokenId, valid: false, isInvalidTokenId };
            }
          })()
        );
      }
      
      const results = await Promise.all(promises);
      
      // Check if we've reached the end of valid tokens
      const invalidTokens = results.filter(r => !r.valid);
      const invalidTokenIds = results.filter(r => r.isInvalidTokenId);
      
      if (invalidTokenIds.length === batchSize) {
        invalidTokenCount += invalidTokenIds.length;
        if (invalidTokenCount >= maxInvalidTokens) {
          console.log(`Found ${maxInvalidTokens} invalid token IDs in a row, assuming we've reached the end of the collection`);
          break;
        }
      } else {
        // Reset the counter if we found any valid tokens
        invalidTokenCount = 0;
      }
      
      // Update holder counts for valid tokens
      for (const result of results) {
        if (result.valid && result.owner !== '0x0000000000000000000000000000000000000000') {
          holderCounts.set(result.owner, (holderCounts.get(result.owner) || 0) + 1);
        }
      }
      
      // Log progress
      console.log(`Processed up to token ID ${i + batchSize - 1}, found ${holderCounts.size} unique holders so far`);
      
      // Add a small delay between batches to avoid rate limiting
      await sleepUtil(200);
    }
    
    console.log(`Found ${holderCounts.size} unique holders`);
    
    // Convert to our NftHolder format
    const holders: NftHolder[] = [];
    for (const [address, tokenCount] of holderCounts.entries()) {
      if (tokenCount >= MIN_NFT_BALANCE) {
        holders.push({
          address,
          tokenCount,
          tokenName: NFT_NAME
        });
      }
    }
    
    // Sort holders by token count (descending)
    holders.sort((a, b) => b.tokenCount - a.tokenCount);
    
    console.log(`Found ${holders.length} holders with at least ${MIN_NFT_BALANCE} ${NFT_NAME}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching NFT holders for ${nftAddress}:`, error);
    return [];
  }
}

/**
 * Fetch Arenabook social profile for a given address
 */
async function fetchArenabookSocial(address: string): Promise<ArenabookUserResponse | null> {
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
            await sleepUtil(REQUEST_DELAY_MS);
          } else {
            console.error(`Failed after ${MAX_RETRIES} retries for ${address}:`, error.response.status, error.response.statusText);
            return null;
          }
        }
      } else {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          console.log(`Unexpected error for ${address}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
          await sleepUtil(REQUEST_DELAY_MS);
        } else {
          console.error(`Failed after ${MAX_RETRIES} retries for ${address}:`, error);
          return null;
        }
      }
    }
  }
  
  return null;
}

/**
 * Process holders and fetch their social profiles
 */
async function processHoldersWithSocials<T extends { address: string }>(
  holders: T[],
  outputPath: string,
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
    
    // Save intermediate results every batch
    const holdersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
    const twitterHandles = holdersWithTwitter.map(h => h.twitter_handle);
    const outputData = { handles: twitterHandles };
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`Saved intermediate results after ${i + batchSize} addresses (${holdersWithTwitter.length} with Twitter handles)`);
    
    // Delay before next batch
    if (i + batchSize < holders.length) {
      await sleepUtil(REQUEST_DELAY_MS);
    }
  }
  
  // Save final results
  const finalHoldersWithTwitter = holdersWithSocials.filter(h => h.twitter_handle !== null);
  const finalTwitterHandles = finalHoldersWithTwitter.map(h => h.twitter_handle);
  const finalOutputData = { handles: finalTwitterHandles };
  fs.writeFileSync(outputPath, JSON.stringify(finalOutputData, null, 2), 'utf8');
  
  // Log statistics
  console.log(`\nFinal statistics for ${processingName}:`);
  console.log(`Total holders processed: ${holders.length}`);
  console.log(`Holders with social profiles: ${socialCount}`);
  console.log(`Holders with Twitter handles: ${finalHoldersWithTwitter.length}`);
  
  return addressToTwitterHandle;
}

/**
 * Main function to fetch token holders and their social profiles
 */
export async function fetchTokenHolderProfiles(): Promise<HolderResults> {
  try {
    // Define token addresses to check
    const tokenAddress = typedConfig.tokens[0].address;
    
    console.log('Starting to fetch token holders and their social profiles...');
    console.log(`Token address to check: ${TOKEN_SYMBOLS[tokenAddress.toLowerCase()]}: ${tokenAddress} (min balance: ${MIN_TOKEN_BALANCES[tokenAddress.toLowerCase()]})`);
    console.log(`NFT to check: ${NFT_NAME} (${NFT_CONTRACT}) (min balance: ${MIN_NFT_BALANCE})`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(NFT_HOLDERS_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Fetch token holders
    console.log('\nFetching token holders...');
    const tokenHolders = await fetchTokenHoldersFromSnowtrace(tokenAddress);
    
    // Fetch NFT holders
    console.log('\nFetching NFT holders...');
    const nftHolders = await fetchNftHoldersFromEthers(NFT_CONTRACT);
    
    // Process NFT holders
    const addressToTwitterHandle = await processHoldersWithSocials<NftHolder>(
      nftHolders,
      NFT_HOLDERS_PATH,
      "NFT holders",
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null,
      })
    );
    
    // Find addresses that have both MUV tokens and NFTs
    console.log("\nFinding holders with both MUV tokens and NFTs...");
    const muvAddresses = new Set(tokenHolders.map(h => h.address.toLowerCase()));
    const nftAddresses = new Set(nftHolders.map(h => h.address.toLowerCase()));
    
    const combinedAddresses = [...nftAddresses].filter(address => muvAddresses.has(address));
    
    console.log(`Found ${combinedAddresses.length} addresses that hold both MUV tokens and NFTs`);
    
    // Get Twitter handles for combined holders
    const combinedHandles = combinedAddresses
      .map(address => addressToTwitterHandle.get(address))
      .filter(handle => handle !== null && handle !== undefined) as string[];
    
    // Save combined results
    const combinedOutputData = { handles: combinedHandles };
    fs.writeFileSync(COMBINED_HOLDERS_PATH, JSON.stringify(combinedOutputData, null, 2), 'utf8');
    
    console.log(`\nSaved ${combinedHandles.length} Twitter handles of holders with both MUV tokens and NFTs`);
    
    return {
      nftHolders: combinedHandles,
      combinedHolders: combinedHandles
    };
  } catch (error) {
    console.error('Error in fetchTokenHolderProfiles:', error);
    return {
      nftHolders: [],
      combinedHolders: []
    };
  }
}

// Run the main function only if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  fetchTokenHolderProfiles().catch(console.error);
}
