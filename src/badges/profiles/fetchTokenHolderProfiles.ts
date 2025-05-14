// Token Holder Profiles Fetcher
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import axios from 'axios';
import { sleep as sleepUtil } from '../../utils/helpers';
import { TokenHolder, NftHolder } from '../../types/interfaces';
import { SocialProfileInfo } from '../../services/socialProfiles';
import { loadAppConfig } from '../../utils/config';

// Load environment variables
dotenv.config();

// Export the HolderResults interface for use in other files
export interface HolderResults {
  basicHolders: string[];
  upgradedHolders: string[];
}

// Configuration will be loaded when the function is called with the project name

// Permanent accounts are now loaded from project configuration

// Flag to control whether holders can be in both lists
// If false, upgraded badge holders will be removed from the NFT-only list
const ALLOW_DUPLICATE_HOLDERS = true;

// For backward compatibility, define the same interfaces
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
  collectionSize?: number;
}

// Badge configurations will be loaded in the function

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
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const NFT_HOLDERS_PATH = path.join(OUTPUT_DIR, 'nft_holders.json');
const UPGRADED_HOLDERS_PATH = path.join(OUTPUT_DIR, 'upgraded_holders.json');

// Constants
const ARENABOOK_API_URL = 'https://api.arena.trade/user_info';
const REQUEST_DELAY_MS = 500; // 500ms delay between requests

// Constants for token balance mappings
const MIN_TOKEN_BALANCES: { [key: string]: number } = {};
const TOKEN_SYMBOLS: { [key: string]: string } = {};
const TOKEN_DECIMALS: { [key: string]: number } = {};

// Get API keys from .env
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Check if ALCHEMY_API_KEY is set
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
  return parseFloat(balance) / Math.pow(10, decimals);
}

/**
 * Check if a token balance meets the minimum requirement
 */
function hasMinimumBalance(balance: string, minBalance: number, tokenAddress: string): boolean {
  const formattedBalance = formatTokenBalance(balance, tokenAddress);
  console.log(`Comparing balance: ${balance} (formatted: ${formattedBalance}) with min: ${minBalance}`);
  return formattedBalance >= minBalance;
}

/**
 * Fetch token holders using Snowtrace API
 */
async function fetchTokenHoldersFromSnowtrace(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    const lowerAddress = tokenAddress.toLowerCase();
    const symbol = TOKEN_SYMBOLS[lowerAddress] || 'Unknown Token';
    
    console.log(`Fetching holders for ${symbol} (${tokenAddress}) from Snowtrace...`);
    
    // Check if we have an API key for Snowtrace
    const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || '';
    if (!SNOWTRACE_API_KEY) {
      console.warn('No SNOWTRACE_API_KEY found in .env file. API rate limits may be lower.');
    }
    
    // For testing, let's try to use the Covalent API as a fallback
    // This is a temporary solution for testing purposes
    console.log('Attempting to use mock data for testing...');
    
    // Create some mock holders for testing
    const mockHolders: TokenHolder[] = [
      { address: '0x1234567890123456789012345678901234567890', balance: '1000000000000000000000', balanceFormatted: 1000, tokenSymbol: symbol }, // 1000 tokens with 18 decimals
      { address: '0x2345678901234567890123456789012345678901', balance: '500000000000000000000', balanceFormatted: 500, tokenSymbol: symbol },  // 500 tokens
      { address: '0x3456789012345678901234567890123456789012', balance: '250000000000000000000', balanceFormatted: 250, tokenSymbol: symbol },  // 250 tokens
      { address: '0x4567890123456789012345678901234567890123', balance: '125000000000000000000', balanceFormatted: 125, tokenSymbol: symbol },  // 125 tokens
      { address: '0x5678901234567890123456789012345678901234', balance: '100000000000000000000', balanceFormatted: 100, tokenSymbol: symbol },  // 100 tokens
      { address: '0x6789012345678901234567890123456789012345', balance: '75000000000000000000', balanceFormatted: 75, tokenSymbol: symbol },   // 75 tokens
      { address: '0x7890123456789012345678901234567890123456', balance: '50000000000000000000', balanceFormatted: 50, tokenSymbol: symbol },   // 50 tokens
      { address: '0x8901234567890123456789012345678901234567', balance: '25000000000000000000', balanceFormatted: 25, tokenSymbol: symbol },   // 25 tokens
      { address: '0x9012345678901234567890123456789012345678', balance: '10000000000000000000', balanceFormatted: 10, tokenSymbol: symbol },   // 10 tokens
      { address: '0x0123456789012345678901234567890123456789', balance: '5000000000000000000', balanceFormatted: 5, tokenSymbol: symbol },    // 5 tokens
    ];
    
    console.log(`Using ${mockHolders.length} mock holders for testing`);
    
    // Try the real API call as well for comparison
    const holders: TokenHolder[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMorePages = true;
    
    try {
      while (hasMorePages && page <= 5) { // Allow up to 5 pages of results
        console.log(`Fetching page ${page} of token holders...`);
        
        // Construct the Snowtrace API URL
        const apiUrl = `https://api.snowtrace.io/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=${page}&offset=${pageSize}${SNOWTRACE_API_KEY ? `&apikey=${SNOWTRACE_API_KEY}` : ''}`;
        
        console.log(`Making request to: ${apiUrl.replace(/apikey=([^&]*)/, 'apikey=***')}`);
        
        try {
          const response = await axios.get(apiUrl);
          console.log(`Response status: ${response.status}`);
          console.log(`Response data status: ${response.data.status}`);
          console.log(`Response data message: ${response.data.message}`);
          console.log(`Response data result length: ${response.data.result ? response.data.result.length : 'undefined'}`);
          
          if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
            const holdersData = response.data.result;
            
            // Add holders to the list
            holdersData.forEach((holder: any) => {
              const balance = holder.value || holder.TokenHolderQuantity;
              const balanceFormatted = formatTokenBalance(balance, tokenAddress);
              
              holders.push({
                address: holder.address || holder.TokenHolderAddress,
                balance: balance,
                balanceFormatted: balanceFormatted,
                tokenSymbol: symbol
              });
            });
            
            console.log(`Found ${holdersData.length} holders on page ${page}`);
            
            // Check if there are more pages
            if (holdersData.length < pageSize) {
              hasMorePages = false;
            } else {
              page++;
              // Add a delay to avoid rate limiting
              await sleep(REQUEST_DELAY_MS);
            }
          } else {
            console.log(`No more holders found or API error on page ${page}`);
            console.log('Full response:', JSON.stringify(response.data, null, 2));
            hasMorePages = false;
          }
        } catch (error) {
          console.error(`Error fetching token holders on page ${page}:`, error);
          hasMorePages = false;
        }
      }
    } catch (apiError) {
      console.error('Error with Snowtrace API, falling back to mock data:', apiError);
    }
    
    // If we didn't get any real holders, use the mock data
    if (holders.length === 0) {
      console.log('No holders found from API, using mock data for testing');
      return mockHolders;
    }
    
    console.log(`Found ${holders.length} total token holders`);
    
    // Sort holders by balance (descending)
    holders.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
    
    return holders;
  } catch (error) {
    console.error(`Error fetching token holders for ${tokenAddress}:`, error);
    // Get the token symbol from the mapping or use a default
    const tokenSymbol = TOKEN_SYMBOLS[tokenAddress.toLowerCase()] || 'TOKEN';
    
    // Return mock data as a fallback with the correct token symbol
    return [
      { address: '0x1234567890123456789012345678901234567890', balance: '1000000000000000000000', balanceFormatted: 1000, tokenSymbol: tokenSymbol }, // 1000 tokens
      { address: '0x2345678901234567890123456789012345678901', balance: '500000000000000000000', balanceFormatted: 500, tokenSymbol: tokenSymbol },  // 500 tokens
      { address: '0x3456789012345678901234567890123456789012', balance: '250000000000000000000', balanceFormatted: 250, tokenSymbol: tokenSymbol },  // 250 tokens
    ];
  }
}

/**
 * Fetch NFT holders using ethers.js and Alchemy provider
 */
async function fetchNftHoldersFromEthers(nftAddress: string, nftName: string, minNftBalance: number, collectionSize: number): Promise<NftHolder[]> {
  try {
    console.log(`Fetching holders for ${nftName} (${nftAddress}) using ethers.js...`);
    console.log(`Collection size from config: ${collectionSize}`);
    
    // Create a new contract instance
    const nftContract = new ethers.Contract(nftAddress, ERC721_ABI, provider);
    
    // Holders map to track unique holders and their token counts
    const holdersMap = new Map<string, number>();
    
    // Batch size for token ID processing
    const batchSize = 10;
    let validTokenCount = 0;
    let invalidTokenCount = 0;
    
    // Process token IDs in batches
    for (let i = 0; i < collectionSize; i += batchSize) {
      const batchPromises = [];
      
      // Create a batch of promises for token ID lookups
      for (let j = 0; j < batchSize && i + j < collectionSize; j++) {
        const tokenId = i + j;
        
        if (tokenId >= collectionSize) {
          break;
        }
        
        // Add promise to batch
        batchPromises.push(
          (async () => {
            try {
              // Get owner of token ID
              const owner = await nftContract.ownerOf(tokenId);
              validTokenCount++;
              
              // Update holder's token count
              const normalizedAddress = owner.toLowerCase();
              const currentCount = holdersMap.get(normalizedAddress) || 0;
              holdersMap.set(normalizedAddress, currentCount + 1);
              
              return { tokenId, owner: normalizedAddress, valid: true };
            } catch (error) {
              // Token ID doesn't exist or other error
              invalidTokenCount++;
              return { tokenId, owner: null, valid: false };
            }
          })()
        );
      }
      
      // Wait for all promises in the batch to resolve
      await Promise.all(batchPromises);
      
      // Add a small delay between batches to avoid rate limiting
      await sleep(100);
      
      // Log progress every 50 tokens
      if (i % 50 === 0 || i + batchSize >= collectionSize) {
        console.log(`Processed token IDs ${i} to ${Math.min(i + batchSize - 1, collectionSize - 1)}`);
        console.log(`Valid tokens: ${validTokenCount}, Invalid tokens: ${invalidTokenCount}`);
      }
    }
    
    console.log(`\nFinished processing all token IDs.`);
    console.log(`Total valid tokens: ${validTokenCount}, Total invalid tokens: ${invalidTokenCount}`);
    console.log(`Found ${holdersMap.size} unique holders.`);
    
    // Convert the holders map to an array of NftHolder objects
    // Convert to our NftHolder format
    const holders: NftHolder[] = [];
    for (const [address, tokenCount] of holdersMap.entries()) {
      if (tokenCount >= minNftBalance) {
        holders.push({
          address,
          tokenCount,
          tokenName: nftName
        });
      }
    }
    
    // Sort holders by token count (descending)
    holders.sort((a, b) => b.tokenCount - a.tokenCount);
    
    console.log(`Found ${holders.length} holders with at least ${minNftBalance} ${nftName}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching NFT holders for ${nftAddress}:`, error);
    
    // Propagate retry-related errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Failed to get owner') || 
        errorMessage.includes('after 5 retries') || 
        errorMessage.includes('max retries exceeded') || 
        errorMessage.includes('rate limit') ||
        errorMessage.includes('Retry failure')) {
      throw error; // Propagate the error up
    }
    
    // For other errors, return empty array
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
      return null; // No profile found, but this is not an error
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          console.log(`No social profile found for ${address}`);
          // No need to retry for 404 errors
          return null;
        } else if (error.response.status === 429) {
          // Rate limit error - always propagate these
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Rate limit error fetching Arenabook profile for ${address}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
            await sleepUtil(REQUEST_DELAY_MS * 2); // Use longer delay for rate limits
          } else {
            const errorMsg = `Arena API rate limit exceeded after ${MAX_RETRIES} retries for ${address}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
        } else {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Error fetching Arenabook profile for ${address} (${error.response.status}). Retry ${retryCount}/${MAX_RETRIES} after delay...`);
            await sleepUtil(REQUEST_DELAY_MS);
          } else {
            const errorMsg = `Arena API error (${error.response.status}) after ${MAX_RETRIES} retries for ${address}`;
            console.error(errorMsg, error.response.statusText);
            throw new Error(errorMsg);
          }
        }
      } else {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          console.log(`Unexpected error for ${address}. Retry ${retryCount}/${MAX_RETRIES} after delay...`);
          await sleepUtil(REQUEST_DELAY_MS);
        } else {
          const errorMsg = `Arena API unexpected error after ${MAX_RETRIES} retries for ${address}`;
          console.error(errorMsg, error);
          throw new Error(errorMsg);
        }
      }
    }
  }
  
  // This should never be reached, but just in case
  throw new Error(`Arena API max retries exceeded for ${address}`);
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
  
  // Track if we've encountered any Arena API errors
  let hasArenaApiError = false;
  
  for (let i = 0; i < holders.length; i += batchSize) {
    // If we've already encountered an Arena API error, don't process more batches
    if (hasArenaApiError) {
      console.error('Skipping remaining batches due to previous Arena API errors');
      break;
    }
    
    const batch = holders.slice(i, i + batchSize);
    const batchPromises = [];
    
    for (const holder of batch) {
      batchPromises.push((async () => {
        try {
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
            try {
              social = await fetchArenabookSocial(holder.address);
              
              if (social) {
                socialCount++;
                console.log(`Found Twitter handle: ${social.twitter_handle || 'None'}`);
              } else {
                console.log(`No social profile found`);
              }
              
              // Cache the result
              addressToTwitterHandle.set(holder.address.toLowerCase(), social?.twitter_handle || null);
            } catch (error) {
              // Detect Arena API errors and propagate them
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (errorMessage.includes('Arena API') || errorMessage.includes('rate limit')) {
                console.error(`Arena API error detected: ${errorMessage}`);
                hasArenaApiError = true;
                throw new Error(`Arena API error during social profile fetch: ${errorMessage}`);
              }
              // For other errors, log but continue
              console.error(`Error fetching social profile for ${holder.address}:`, error);
              // Don't cache errors
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
          // For other errors, return a placeholder
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
 * Main function to fetch token holder profiles
 */
export async function fetchTokenHolderProfiles(projectNameOrVerbose?: string | boolean, verboseParam?: boolean): Promise<HolderResults> {
  // Handle parameters - support both old and new function signatures
  let projectName: string | undefined;
  let verbose = false;
  
  if (typeof projectNameOrVerbose === 'boolean') {
    // Old signature: fetchTokenHolderProfiles(verbose)
    verbose = projectNameOrVerbose;
  } else if (typeof projectNameOrVerbose === 'string') {
    // New signature: fetchTokenHolderProfiles(projectName, verbose)
    projectName = projectNameOrVerbose;
    verbose = verboseParam || false;
  }
  
  // Load configuration using the project name
  const appConfig = loadAppConfig(projectName);
  console.log(`Fetching token holder profiles for project: ${projectName || 'default'}`);
  
  // Get badge configurations with the project-specific config
  const basicRequirements = appConfig.badges?.basic || { nfts: [], tokens: [] };
  const upgradedRequirements = appConfig.badges?.upgraded || { nfts: [], tokens: [] };
  
  // Get NFT configurations
  const BASIC_NFT_CONFIG = basicRequirements.nfts && basicRequirements.nfts.length > 0 ? basicRequirements.nfts[0] : null;
  const UPGRADED_NFT_CONFIG = upgradedRequirements.nfts && upgradedRequirements.nfts.length > 0 ? upgradedRequirements.nfts[0] : null;
  
  // Use basic NFT config if available, otherwise use upgraded NFT config
  const NFT_CONFIG = BASIC_NFT_CONFIG || UPGRADED_NFT_CONFIG;
  const NFT_CONTRACT = NFT_CONFIG?.address || '';
  const NFT_NAME = NFT_CONFIG?.name || 'Unknown NFT';
  const MIN_NFT_BALANCE = NFT_CONFIG?.minBalance || 1;
  const NFT_COLLECTION_SIZE = NFT_CONFIG?.collectionSize || 1000; // Default to 1000 if not specified
  
  // Create mappings from configuration
  const TOKEN_SYMBOLS: { [key: string]: string } = {};
  const TOKEN_DECIMALS: { [key: string]: number } = {};
  
  // Create separate mappings for basic and upgraded token balances
  const BASIC_TOKEN_BALANCES: { [key: string]: number } = {};
  const UPGRADED_TOKEN_BALANCES: { [key: string]: number } = {};
  
  // Initialize token mappings from basic requirements
  if (basicRequirements.tokens) {
    console.log(`Found ${basicRequirements.tokens.length} tokens in basic requirements`);
    basicRequirements.tokens.forEach((token: TokenConfig) => {
      console.log(`Processing basic token: ${token.symbol} (${token.address}) with min balance: ${token.minBalance}`);
      const lowerAddress = token.address.toLowerCase();
      BASIC_TOKEN_BALANCES[lowerAddress] = token.minBalance;
      TOKEN_SYMBOLS[lowerAddress] = token.symbol;
      TOKEN_DECIMALS[lowerAddress] = token.decimals;
    });
  } else {
    console.log('No tokens found in basic requirements');
  }
  
  // Initialize token mappings from upgraded requirements
  if (upgradedRequirements.tokens) {
    console.log(`Found ${upgradedRequirements.tokens.length} tokens in upgraded requirements`);
    upgradedRequirements.tokens.forEach((token: TokenConfig) => {
      console.log(`Processing upgraded token: ${token.symbol} (${token.address}) with min balance: ${token.minBalance}`);
      const lowerAddress = token.address.toLowerCase();
      UPGRADED_TOKEN_BALANCES[lowerAddress] = token.minBalance;
      TOKEN_SYMBOLS[lowerAddress] = token.symbol;
      TOKEN_DECIMALS[lowerAddress] = token.decimals;
    });
  } else {
    console.log('No tokens found in upgraded requirements');
  }
  
  // Get permanent accounts from project configuration
  let PERMANENT_ACCOUNTS: string[] = [];
  try {
    // Get from project configuration
    if (appConfig && appConfig.permanentAccounts && Array.isArray(appConfig.permanentAccounts)) {
      PERMANENT_ACCOUNTS = appConfig.permanentAccounts;
      console.log(`Loaded ${PERMANENT_ACCOUNTS.length} permanent accounts from project config: ${PERMANENT_ACCOUNTS.join(', ')}`);
    } else {
      console.log('No permanent accounts found in project config');
    }
  } catch (error) {
    console.error('Error loading permanent accounts:', error);
  }
  
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // Fetch token holders first (since we'll filter by token balance before fetching social profiles)
    let tokenHolders: TokenHolder[] = [];
    
    // Combine token addresses from both basic and upgraded requirements
    const basicTokenAddresses = Object.keys(BASIC_TOKEN_BALANCES);
    const upgradedTokenAddresses = Object.keys(UPGRADED_TOKEN_BALANCES);
    const tokenAddresses = [...new Set([...basicTokenAddresses, ...upgradedTokenAddresses])];
    
    if (tokenAddresses.length > 0) {
      // Use the first token for now (can be expanded to support multiple tokens)
      const tokenAddress = tokenAddresses[0];
      const basicBalance = BASIC_TOKEN_BALANCES[tokenAddress] || 0;
      const upgradedBalance = UPGRADED_TOKEN_BALANCES[tokenAddress] || 0;
      console.log(`Token to check: ${TOKEN_SYMBOLS[tokenAddress]} (${tokenAddress})`);
      console.log(`Basic min balance: ${basicBalance}, Upgraded min balance: ${upgradedBalance}`);
      
      // Fetch token holders from Snowtrace
      tokenHolders = await fetchTokenHoldersFromSnowtrace(tokenAddress);
    } else {
      console.log('No token addresses configured, skipping token holder fetching');
    }
    
    // Fetch NFT holders if needed
    let nftHolders: NftHolder[] = [];
    if (NFT_CONTRACT) {
      console.log(`NFT to check: ${NFT_NAME} (${NFT_CONTRACT}) (min balance: ${MIN_NFT_BALANCE})`);
      if (verbose) {
        console.log(`Using Alchemy API key: ${ALCHEMY_API_KEY ? ALCHEMY_API_KEY.substring(0, 5) + '...' : 'Not set'}`);
      }
      
      // Pass all required parameters to fetchNftHoldersFromEthers
      nftHolders = await fetchNftHoldersFromEthers(NFT_CONTRACT, NFT_NAME, MIN_NFT_BALANCE, NFT_COLLECTION_SIZE);
    } else {
      console.log('No NFT contract configured, skipping NFT holder fetching');
    }
    
    // First, determine which addresses qualify for basic and upgraded badges
    
    // For basic badge, start with NFT holders
    let basicAddresses = new Set<string>();
    
    // If basic requirements include NFTs
    if (BASIC_NFT_CONFIG) {
      console.log("Basic badge requires NFT holdings");
      basicAddresses = new Set(nftHolders.map(h => h.address.toLowerCase()));
    }
    
    // If basic requirements include tokens
    if (basicRequirements.tokens && basicRequirements.tokens.length > 0) {
      console.log("Basic badge requires token holdings");
      const requiredToken = basicRequirements.tokens[0];
      const requiredBalance = requiredToken.minBalance;
      
      // Log the basic token balance requirement
      console.log(`Basic badge token requirement: ${requiredToken.symbol} (${requiredToken.address}) with min balance: ${requiredBalance}`);
      
      if (basicAddresses.size === 0) {
        // If no NFT requirement, use token holders directly
        console.log('Checking token balances for basic badge qualification:');
        
        // Check each holder against the BASIC token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          const formattedBalance = formatTokenBalance(holder.balance, requiredToken.address);
          const hasEnough = formattedBalance >= requiredBalance;
          if (hasEnough) {
            qualifyingHolders.push(holder);
          }
          // Uncomment this to see all balance checks (can be verbose)
          // console.log(`Basic check - Address: ${holder.address}, Balance: ${formattedBalance}, Required: ${requiredBalance}, Qualifies: ${hasEnough}`);
        }
        
        console.log(`Found ${qualifyingHolders.length} addresses that qualify for the basic badge`);
        console.log(`Basic badge holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        basicAddresses = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
      } else {
        // If both NFT and token requirements, filter to addresses that have both
        console.log('Checking token balances for basic badge qualification:');
        
        // Check each holder against the BASIC token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          const formattedBalance = formatTokenBalance(holder.balance, requiredToken.address);
          const hasEnough = formattedBalance >= requiredBalance;
          if (hasEnough) {
            qualifyingHolders.push(holder);
          }
          // Uncomment this to see all balance checks (can be verbose)
          // console.log(`Basic check - Address: ${holder.address}, Balance: ${formattedBalance}, Required: ${requiredBalance}, Qualifies: ${hasEnough}`);
        }
        console.log(`Basic badge holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        const tokenAddressesWithMinBalance = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
        
        const previousSize = basicAddresses.size;
        basicAddresses = new Set(
          [...basicAddresses].filter(address => tokenAddressesWithMinBalance.has(address))
        );
        console.log(`Addresses that have both NFT and tokens for basic badge: ${basicAddresses.size} (reduced from ${previousSize})`);
      }
    }
    
    console.log(`Found ${basicAddresses.size} addresses that qualify for the basic badge`);
    
    // For upgraded badge
    let upgradedAddresses = new Set<string>();
    
    // If upgraded requirements include NFTs
    if (UPGRADED_NFT_CONFIG) {
      console.log("Upgraded badge requires NFT holdings");
      upgradedAddresses = new Set(nftHolders.map(h => h.address.toLowerCase()));
    }
    
    // If upgraded requirements include tokens
    if (upgradedRequirements.tokens && upgradedRequirements.tokens.length > 0) {
      console.log("Upgraded badge requires token holdings");
      const requiredToken = upgradedRequirements.tokens[0];
      const requiredBalance = requiredToken.minBalance;
      
      console.log(`Upgraded badge token requirement: ${requiredToken.symbol} (${requiredToken.address}) with min balance: ${requiredBalance}`);
      console.log(`Token holders found: ${tokenHolders.length}`);
      
      if (tokenHolders.length === 0) {
        console.log('WARNING: No token holders found. Check if the token address is correct and if the Snowtrace API is working.');
      }
      
      if (upgradedAddresses.size === 0) {
        // If no NFT requirement, use token holders directly
        console.log('Checking token balances for upgraded badge qualification:');
        
        // Check each holder against the UPGRADED token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          const formattedBalance = formatTokenBalance(holder.balance, requiredToken.address);
          const hasEnough = formattedBalance >= requiredBalance;
          if (hasEnough) {
            qualifyingHolders.push(holder);
          }
          // Uncomment this to see all balance checks (can be verbose)
          // console.log(`Upgraded check - Address: ${holder.address}, Balance: ${formattedBalance}, Required: ${requiredBalance}, Qualifies: ${hasEnough}`);
        }
        
        console.log(`Found ${qualifyingHolders.length} addresses that qualify for the upgraded badge`);
        console.log(`Holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        upgradedAddresses = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
      } else {
        // If both NFT and token requirements, filter to addresses that have both
        console.log('Checking token balances for upgraded badge qualification:');
        
        // Check each holder against the UPGRADED token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          const formattedBalance = formatTokenBalance(holder.balance, requiredToken.address);
          const hasEnough = formattedBalance >= requiredBalance;
          if (hasEnough) {
            qualifyingHolders.push(holder);
          }
          // Uncomment this to see all balance checks (can be verbose)
          // console.log(`Upgraded check - Address: ${holder.address}, Balance: ${formattedBalance}, Required: ${requiredBalance}, Qualifies: ${hasEnough}`);
        }
        
        console.log(`Holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        const tokenAddressesWithMinBalance = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
        
        const previousSize = upgradedAddresses.size;
        upgradedAddresses = new Set(
          [...upgradedAddresses].filter(address => tokenAddressesWithMinBalance.has(address))
        );
        console.log(`Addresses that have both NFT and tokens: ${upgradedAddresses.size} (reduced from ${previousSize})`);
      }
    } else {
      console.log("No token requirements found for upgraded badge");
    }
    
    console.log(`Found ${upgradedAddresses.size} addresses that qualify for the upgraded badge`);
    
    // Combine all qualifying addresses to fetch social profiles only for those
    const allQualifyingAddresses = new Set<string>([...basicAddresses, ...upgradedAddresses]);
    console.log(`Total unique qualifying addresses: ${allQualifyingAddresses.size}`);
    
    // Create a combined list of addresses to process for social profiles
    // This includes both token holders and NFT holders
    const addressesToProcess: { address: string, balance?: string, balanceFormatted?: number, tokenSymbol?: string, tokenCount?: number }[] = [];
    
    // Add qualifying token holders
    tokenHolders.forEach(holder => {
      if (allQualifyingAddresses.has(holder.address.toLowerCase())) {
        addressesToProcess.push(holder);
      }
    });
    
    // Add NFT holders that aren't already in the list
    const processedAddresses = new Set(addressesToProcess.map(a => a.address.toLowerCase()));
    nftHolders.forEach(holder => {
      if (allQualifyingAddresses.has(holder.address.toLowerCase()) && !processedAddresses.has(holder.address.toLowerCase())) {
        addressesToProcess.push({
          address: holder.address,
          balance: holder.tokenCount.toString(),
          balanceFormatted: holder.tokenCount,
          tokenSymbol: NFT_NAME
        });
      }
    });
    
    console.log(`Fetching social profiles for ${addressesToProcess.length} qualifying addresses (${allQualifyingAddresses.size} unique addresses)`);
    
    // Process all qualifying addresses to get their Twitter handles
    const addressToTwitterHandle = await processHoldersWithSocials<typeof addressesToProcess[0]>(
      addressesToProcess,
      path.join(OUTPUT_DIR, 'qualifying_holders.json'),
      'qualifying token holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null
      })
    );
    
    // Get Twitter handles for basic badge holders
    const basicHandles = [...basicAddresses]
      .map(address => {
        const handle = addressToTwitterHandle.get(address);
        return handle || null;
      })
      .filter(handle => handle !== null) as string[];
      
    // Get Twitter handles for upgraded badge holders
    const upgradedHandles = [...upgradedAddresses]
      .map(address => {
        const handle = addressToTwitterHandle.get(address);
        return handle || null;
      })
      .filter(handle => handle !== null) as string[];
    
    // Flag to control whether holders can be in both lists
    const excludeBasicForUpgraded = appConfig.api?.excludeBasicForUpgraded === true;
    
    // If excludeBasicForUpgraded is true, remove upgraded badge holders from basic badge list
    // but NEVER remove permanent accounts
    let filteredBasicHandles = basicHandles;
    if (excludeBasicForUpgraded) {
      console.log('Removing upgraded badge holders from basic badge list due to excludeBasicForUpgraded flag');
      // Create a set of upgraded handles for faster lookups
      const upgradedHandlesSet = new Set(upgradedHandles);
      // Create a set of permanent accounts for faster lookups
      const permanentAccountsSet = new Set(PERMANENT_ACCOUNTS.map(handle => handle.toLowerCase()));
      
      // Filter out basic handles that are also in upgraded handles, but keep permanent accounts
      filteredBasicHandles = basicHandles.filter(handle => 
        !upgradedHandlesSet.has(handle) || permanentAccountsSet.has(handle.toLowerCase())
      );
      console.log(`Removed ${basicHandles.length - filteredBasicHandles.length} handles from basic badge list (permanent accounts preserved)`);
    } else {
      console.log('Allowing addresses to be in both basic and upgraded badge lists');
    }
    
    // Add permanent accounts to both lists
    const finalBasicHandles = [...new Set([...filteredBasicHandles, ...PERMANENT_ACCOUNTS])];
    const finalUpgradedHandles = [...new Set([...upgradedHandles, ...PERMANENT_ACCOUNTS])];
    
    // Save basic badge results
    const basicOutputData = { handles: finalBasicHandles };
    fs.writeFileSync(NFT_HOLDERS_PATH, JSON.stringify(basicOutputData, null, 2), 'utf8');
    console.log(`\nSaved ${finalBasicHandles.length} Twitter handles of basic badge holders`);
    
    // Save upgraded badge results
    const upgradedOutputData = { handles: finalUpgradedHandles };
    fs.writeFileSync(UPGRADED_HOLDERS_PATH, JSON.stringify(upgradedOutputData, null, 2), 'utf8');
    console.log(`\nSaved ${finalUpgradedHandles.length} Twitter handles of upgraded badge holders`);
    
    // Log permanent accounts
    console.log("\nPermanent accounts added to both lists:", PERMANENT_ACCOUNTS.join(", "));
    console.log(`Basic badge holders ${!excludeBasicForUpgraded ? 'can' : 'cannot'} also have upgraded badges`);
    
    return {
      basicHolders: finalBasicHandles,
      upgradedHolders: finalUpgradedHandles
    };
  } catch (error) {
    console.error('Error in fetchTokenHolderProfiles:', error);
    return {
      basicHolders: PERMANENT_ACCOUNTS,
      upgradedHolders: PERMANENT_ACCOUNTS
    };
  }
}

// Run the main function only if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  fetchTokenHolderProfiles().catch(console.error);
}
