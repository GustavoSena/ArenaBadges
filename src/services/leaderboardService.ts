import * as fs from 'fs';
import * as path from 'path';
import { TokenHolder, NftHolder, ArenabookUserResponse } from '../types/interfaces';
import { LeaderboardConfig, HolderPoints, LeaderboardEntry, Leaderboard } from '../types/leaderboard';
import { loadConfig } from '../utils/helpers';
import { fetchNftHoldersFromEthers } from '../api/blockchain';
import { processHoldersWithSocials, SocialProfileInfo } from './socialProfiles';
import { saveLeaderboardHtml } from '../utils/htmlGenerator';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { formatTokenBalance, sleep } from '../utils/helpers';

// Load environment variables
dotenv.config();

// Get API key from .env
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
  console.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching token balances.');
}

// Avalanche RPC URL using Alchemy API key
const AVALANCHE_RPC_URL = `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Setup ethers provider for Avalanche
const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC_URL);

// ERC-20 ABI (minimal for balanceOf function)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

/**
 * Load the leaderboard configuration
 */
export function loadLeaderboardConfig(): LeaderboardConfig {
  try {
    const configPath = path.join(__dirname, '../../config/leaderboard.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData) as LeaderboardConfig;
  } catch (error) {
    console.error('Error loading leaderboard config:', error);
    throw new Error('Failed to load leaderboard configuration');
  }
}

/**
 * Fetch token balance for a specific address using Alchemy
 */
async function fetchTokenBalanceWithAlchemy(
  tokenAddress: string,
  holderAddress: string,
  tokenDecimals: number
): Promise<number> {
  try {
    // Create contract instance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    // Get balance
    const balance = await tokenContract.balanceOf(holderAddress);
    
    // Convert to formatted balance
    return Number(ethers.formatUnits(balance, tokenDecimals));
  } catch (error) {
    console.error(`Error fetching token balance for address ${holderAddress}:`, error);
    return 0;
  }
}

/**
 * Fetch token balances for multiple addresses using Alchemy
 */
async function fetchTokenBalancesWithAlchemy(
  tokenAddress: string,
  tokenSymbol: string,
  holderAddresses: string[],
  tokenDecimals: number
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
  let processedCount = 0;
  
  console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses using Alchemy...`);
  
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < holderAddresses.length; i += batchSize) {
    const batch = holderAddresses.slice(i, i + batchSize);
    const batchPromises = batch.map(async (address) => {
      // Add retry mechanism
      const MAX_RETRIES = 3;
      let retryCount = 0;
      
      while (retryCount <= MAX_RETRIES) {
        try {
          const balanceFormatted = await fetchTokenBalanceWithAlchemy(tokenAddress, address, tokenDecimals);
          
          return {
            address,
            balance: ethers.parseUnits(balanceFormatted.toString(), tokenDecimals).toString(),
            balanceFormatted,
            tokenSymbol
          };
        } catch (error) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Error fetching balance for ${address}. Retry ${retryCount}/${MAX_RETRIES}...`);
            // Add a small delay before retrying
            await sleep(500);
          } else {
            console.error(`Failed after ${MAX_RETRIES} retries for address ${address}`);
            return {
              address,
              balance: "0",
              balanceFormatted: 0,
              tokenSymbol
            };
          }
        }
      }
      
      // This should never be reached but TypeScript needs it
      return {
        address,
        balance: "0",
        balanceFormatted: 0,
        tokenSymbol
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    holders.push(...batchResults);
    
    processedCount += batch.length;
    if (processedCount % 20 === 0 || processedCount === holderAddresses.length) {
      console.log(`Processed ${processedCount}/${holderAddresses.length} addresses...`);
    }
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < holderAddresses.length) {
      await sleep(500);
    }
  }
  
  // Count non-zero balances for logging
  const nonZeroBalances = holders.filter(h => h.balanceFormatted > 0).length;
  console.log(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}

/**
 * Calculate points for each holder based on their token and NFT holdings
 * New approach: First fetch NFT holders with social profiles, then fetch token balances only for those addresses
 */
export async function calculateHolderPoints(): Promise<HolderPoints[]> {
  try {
    // Load leaderboard configuration
    const leaderboardConfig = loadLeaderboardConfig();
    
    // Initialize holders map to track points
    const holdersMap = new Map<string, HolderPoints>();
    
    // Step 1: Process NFTs first
    for (const nftWeight of leaderboardConfig.weights.nfts) {
      console.log(`\nFetching holders for ${nftWeight.name} NFT (${nftWeight.address})...`);
      
      // Fetch NFT holders using the original ethers implementation
      const nftHolders = await fetchNftHoldersFromEthers(
        nftWeight.address,
        nftWeight.name,
        nftWeight.minBalance
      );
      
      console.log(`Processing ${nftHolders.length} ${nftWeight.name} NFT holders...`);
      
      // Process NFT holders and calculate points
      for (const holder of nftHolders) {
        const address = holder.address.toLowerCase();
        
        // Initialize holder entry if it doesn't exist
        if (!holdersMap.has(address)) {
          holdersMap.set(address, {
            address,
            twitterHandle: null,
            profileImageUrl: null,
            totalPoints: 0,
            tokenPoints: {},
            nftPoints: {}
          });
        }
        
        // Calculate points for this NFT
        const points = holder.tokenCount * nftWeight.pointsPerNft;
        
        // Update holder points
        const holderPoints = holdersMap.get(address)!;
        holderPoints.nftPoints[nftWeight.name] = points;
        holderPoints.totalPoints += points;
      }
    }
    
    // Step 2: Get all NFT holders
    const nftHolders = Array.from(holdersMap.values());
    
    // Step 3: Fetch social profiles for NFT holders
    console.log(`\nFetching social profiles for ${nftHolders.length} NFT holders...`);
    
    const holdersWithSocials = nftHolders.map(holder => ({
      address: holder.address
    }));
    
    const addressToSocialInfo = await processHoldersWithSocials(
      holdersWithSocials,
      '',
      'NFT holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null,
        twitter_pfp_url: social?.twitter_pfp_url || null
      })
    );
    
    // Step 4: Update NFT holders with social info and filter to only those with Twitter handles
    for (const holder of nftHolders) {
      const socialInfo = addressToSocialInfo.get(holder.address.toLowerCase());
      if (socialInfo && socialInfo.twitter_handle) {
        holder.twitterHandle = socialInfo.twitter_handle;
        holder.profileImageUrl = socialInfo.twitter_pfp_url;
      }
    }
    
    // Filter to only holders with Twitter handles
    const nftHoldersWithSocial = nftHolders.filter(holder => holder.twitterHandle !== null);
    console.log(`\nFound ${nftHoldersWithSocial.length} NFT holders with social profiles`);
    
    // Step 5: For each token, fetch balances only for NFT holders with social profiles
    const holderAddresses = nftHoldersWithSocial.map(h => h.address.toLowerCase());
    
    // Process tokens
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      console.log(`\nFetching ${tokenWeight.symbol} balances for NFT holders with social profiles...`);
      
      // Fetch token balances only for NFT holders with social profiles using Alchemy
      const tokenHolders = await fetchTokenBalancesWithAlchemy(
        tokenWeight.address,
        tokenWeight.symbol,
        holderAddresses,
        18 // Assuming 18 decimals for all tokens
      );
      
      console.log(`Processing ${tokenHolders.length} ${tokenWeight.symbol} holders...`);
      
      // Update holder points with token balances
      for (const holder of tokenHolders) {
        const address = holder.address.toLowerCase();
        if (holdersMap.has(address)) {
          // Calculate points for this token
          const points = holder.balanceFormatted * tokenWeight.pointsPerToken;
          
          // Update holder points
          const holderPoints = holdersMap.get(address)!;
          holderPoints.tokenPoints[tokenWeight.symbol] = points;
          holderPoints.totalPoints += points;
        }
      }
    }
    
    // Return only holders with social profiles
    return nftHoldersWithSocial;
  } catch (error) {
    console.error('Error calculating holder points:', error);
    throw error;
  }
}

/**
 * Generate a leaderboard from holder points
 */
export function generateLeaderboard(holderPoints: HolderPoints[], maxEntries: number = 100): Leaderboard {
  try {
    // Sort holders by total points (descending)
    const sortedHolders = holderPoints.sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Generate leaderboard entries with rankings
    const entries: LeaderboardEntry[] = sortedHolders.slice(0, maxEntries).map((holder, index) => ({
      rank: index + 1,
      twitterHandle: holder.twitterHandle as string, // We already filtered for non-null handles
      profileImageUrl: holder.profileImageUrl,
      address: holder.address,
      totalPoints: holder.totalPoints,
      tokenPoints: holder.tokenPoints,
      nftPoints: holder.nftPoints
    }));
    
    // Create the leaderboard
    const leaderboard: Leaderboard = {
      timestamp: new Date().toISOString(),
      entries
    };
    
    return leaderboard;
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    throw error;
  }
}

/**
 * Save the leaderboard to a file
 */
export function saveLeaderboard(leaderboard: Leaderboard, outputPath: string): void {
  try {
    // Ensure the directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save the leaderboard to a file
    fs.writeFileSync(outputPath, JSON.stringify(leaderboard, null, 2));
    console.log(`Leaderboard saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving leaderboard:', error);
    throw error;
  }
}

/**
 * Main function to generate and save a leaderboard
 */
export async function generateAndSaveLeaderboard(): Promise<Leaderboard> {
  try {
    // Load leaderboard configuration
    const config = loadLeaderboardConfig();
    
    // Calculate holder points
    console.log('Calculating holder points...');
    const holderPoints = await calculateHolderPoints();
    
    // Generate leaderboard
    console.log('Generating leaderboard...');
    const leaderboard = generateLeaderboard(holderPoints, config.output.maxEntries);
    
    // Save leaderboard to JSON file
    const jsonOutputPath = path.join(__dirname, '../../files', config.output.filename);
    saveLeaderboard(leaderboard, jsonOutputPath);
    
    // Save leaderboard to HTML file
    const htmlOutputPath = path.join(__dirname, '../../files', config.output.filename.replace('.json', '.html'));
    saveLeaderboardHtml(leaderboard, htmlOutputPath);
    
    return leaderboard;
  } catch (error) {
    console.error('Error generating and saving leaderboard:', error);
    throw error;
  }
}
