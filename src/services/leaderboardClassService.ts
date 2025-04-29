import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

import { TokenHolder, NftHolder } from '../types/interfaces';
import { LeaderboardConfig, HolderPoints, Leaderboard } from '../types/leaderboard';
import { BaseLeaderboard, MuLeaderboard } from '../types/leaderboardClasses';
import { fetchNftHoldersFromEthers } from '../api/blockchain';
import { fetchTokenHoldersFromMoralis } from '../api/moralis';
import { processHoldersWithSocials, SocialProfileInfo } from './socialProfiles';
import { saveLeaderboardHtml } from '../utils/htmlGenerator';
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
 * Fetch token balance for a specific address using ethers.js
 */
async function fetchTokenBalanceWithEthers(
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
 * Fetch token balances for multiple addresses using ethers.js
 */
async function fetchTokenBalancesWithEthers(
  tokenAddress: string,
  tokenSymbol: string,
  holderAddresses: string[],
  tokenDecimals: number
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
  let processedCount = 0;
  
  console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses using ethers.js...`);
  
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
          const balanceFormatted = await fetchTokenBalanceWithEthers(tokenAddress, address, tokenDecimals);
          
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
            await sleep(1000);
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
    
    try {
      const batchResults = await Promise.all(batchPromises);
      holders.push(...batchResults);
    } catch (error) {
      console.error(`Error processing batch:`, error);
      // Continue with the next batch
    }
    
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
 * using the specified leaderboard implementation
 */
export async function calculateHolderPoints(leaderboardImpl: BaseLeaderboard): Promise<HolderPoints[]> {
  try {
    console.log('\nFetching NFT holders...');
    
    // Load leaderboard configuration
    const leaderboardConfig = loadLeaderboardConfig();
    
    // Create maps to store holder data
    const holderPointsMap = new Map<string, HolderPoints>();
    let addressToSocialInfo = new Map<string, SocialProfileInfo>();
    
    // Process NFT holders first
    for (const nftWeight of leaderboardConfig.weights.nfts) {
      console.log(`Fetching holders for ${nftWeight.name} (${nftWeight.address}) using ethers.js...`);
      
      // Fetch NFT holders using ethers.js
      const nftHolders = await fetchNftHoldersFromEthers(
        nftWeight.address,
        nftWeight.name,
        nftWeight.minBalance || 1
      );
      
      console.log(`Found ${nftHolders.length} holders with at least ${nftWeight.minBalance || 1} ${nftWeight.name}`);
      console.log(`Found ${nftHolders.length} NFT holders`);
      
      // Fetch social profiles for NFT holders
      console.log(`\nFetching social profiles for ${nftHolders.length} NFT holders...\n`);
      
      // Process NFT holders to get their social profiles
      const nftHolderAddresses = nftHolders.map(h => h.address);
      addressToSocialInfo = await processHoldersWithSocials(
        nftHolders,
        path.join(__dirname, '../../files/nft_holders_with_socials.json'),
        `NFT holders`,
        (holder, social) => ({
          address: holder.address,
          tokenName: holder.tokenName,
          tokenCount: holder.tokenCount,
          twitter_handle: social?.twitter_handle || null,
          twitter_pfp_url: social?.twitter_pfp_url || null
        })
      );
      
      // Filter to holders with social profiles
      const nftHoldersWithSocial = nftHolders.filter(h => 
        addressToSocialInfo.has(h.address.toLowerCase()) && 
        addressToSocialInfo.get(h.address.toLowerCase())?.twitter_handle
      );
      
      console.log(`Found ${nftHoldersWithSocial.length} NFT holders with social profiles`);
      
      // Initialize holder points for NFT holders with social profiles
      for (const holder of nftHoldersWithSocial) {
        const address = holder.address.toLowerCase();
        const socialInfo = addressToSocialInfo.get(address);
        
        if (socialInfo?.twitter_handle) {
          // Calculate NFT points using the leaderboard implementation
          const nftPoints = await leaderboardImpl.calculateNftPoints(holder);
          
          holderPointsMap.set(address, {
            address,
            twitterHandle: socialInfo.twitter_handle,
            profileImageUrl: socialInfo.twitter_pfp_url || '',
            totalPoints: nftPoints,
            tokenPoints: {},
            nftPoints: {
              [holder.tokenName]: nftPoints
            }
          });
        }
      }
    }
    
    // Get all eligible addresses with social profiles
    const eligibleAddressesWithSocial = Array.from(holderPointsMap.keys());
    console.log(`\nFound ${eligibleAddressesWithSocial.length} eligible addresses with social profiles`);
    
    // Process token holders
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      console.log(`\nProcessing ${tokenWeight.symbol} token...`);
      
      // Fetch token balances for eligible addresses with social profiles
      const tokenHolders = await fetchTokenBalancesWithEthers(
        tokenWeight.address,
        tokenWeight.symbol,
        eligibleAddressesWithSocial,
        18 // Assuming 18 decimals for all tokens
      );
      
      // Process token holders and calculate points
      for (const holder of tokenHolders) {
        const address = holder.address.toLowerCase();
        
        if (holderPointsMap.has(address) && holder.balanceFormatted > 0) {
          // Calculate points for this token using the leaderboard implementation
          const points = await leaderboardImpl.calculateTokenPoints(holder, tokenWeight.symbol);
          
          // Update holder points
          const holderPoints = holderPointsMap.get(address)!;
          holderPoints.tokenPoints[tokenWeight.symbol] = points;
          holderPoints.totalPoints += points;
        }
      }
    }
    
    // Return holders with social profiles and points
    return Array.from(holderPointsMap.values());
  } catch (error) {
    console.error('Error calculating holder points:', error);
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
 * Generate and save a leaderboard using the MuLeaderboard implementation
 */
export async function generateAndSaveMuLeaderboard(): Promise<Leaderboard> {
  try {
    // Load leaderboard configuration
    const config = loadLeaderboardConfig();
    
    // Create MuLeaderboard instance
    const muLeaderboard = new MuLeaderboard(config, provider);
    
    // Calculate holder points
    console.log('Calculating holder points using MuLeaderboard implementation...');
    const holderPoints = await calculateHolderPoints(muLeaderboard);
    
    // Generate leaderboard
    console.log('Generating leaderboard...');
    const leaderboard = muLeaderboard.generateLeaderboard(holderPoints, config.output.maxEntries);
    
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
