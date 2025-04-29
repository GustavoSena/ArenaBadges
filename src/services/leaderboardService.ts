import * as fs from 'fs';
import * as path from 'path';
import { TokenHolder, NftHolder, ArenabookUserResponse } from '../types/interfaces';
import { LeaderboardConfig, HolderPoints, LeaderboardEntry, Leaderboard } from '../types/leaderboard';
import { loadConfig } from '../utils/helpers';
import { fetchNftHoldersFromEthers } from '../api/blockchain';
import { fetchTokenHoldersFromMoralis } from '../api/moralis';
import { processHoldersWithSocials, SocialProfileInfo } from './socialProfiles';
import { saveLeaderboardHtml } from '../utils/htmlGenerator';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { formatTokenBalance, sleep } from '../utils/helpers';

// Load environment variables
dotenv.config();

// Get API key from .env
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

if (!ALCHEMY_API_KEY) {
  console.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching token balances.');
}

if (!MORALIS_API_KEY) {
  console.warn('MORALIS_API_KEY not found in .env file. Required for fetching token holders.');
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
      await sleep(1000);
    }
  }
  
  // Count non-zero balances for logging
  const nonZeroBalances = holders.filter(h => h.balanceFormatted > 0).length;
  console.log(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}

/**
 * Fetch token holders using ethers.js as a fallback when Moralis fails
 * This will check all addresses that hold the NFT to see if they meet the token minimum balance
 */
async function fetchTokenHoldersWithEthersFallback(
  tokenAddress: string,
  tokenSymbol: string,
  addressesToCheck: string[],
  minBalance: number
): Promise<TokenHolder[]> {
  console.log(`Using ethers.js fallback to check ${addressesToCheck.length} addresses for ${tokenSymbol} with min balance ${minBalance}...`);
  
  const tokenHolders: TokenHolder[] = [];
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = await tokenContract.decimals();
  
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  let processedCount = 0;
  
  for (let i = 0; i < addressesToCheck.length; i += batchSize) {
    const batch = addressesToCheck.slice(i, i + batchSize);
    const batchPromises = batch.map(async (address) => {
      try {
        const balance = await tokenContract.balanceOf(address);
        const balanceFormatted = Number(ethers.formatUnits(balance, decimals));
        
        if (balanceFormatted >= minBalance) {
          return {
            address,
            balance: balance.toString(),
            balanceFormatted,
            tokenSymbol
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${tokenSymbol} balance for ${address}:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    const validHolders = batchResults.filter(holder => holder !== null) as TokenHolder[];
    tokenHolders.push(...validHolders);
    
    processedCount += batch.length;
    if (processedCount % 20 === 0 || processedCount === addressesToCheck.length) {
      console.log(`Processed ${processedCount}/${addressesToCheck.length} addresses for ${tokenSymbol}...`);
    }
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < addressesToCheck.length) {
      await sleep(1000);
    }
  }
  
  console.log(`Found ${tokenHolders.length} addresses with ${tokenSymbol} balance >= ${minBalance}`);
  return tokenHolders;
}

/**
 * Calculate points for each holder based on their token and NFT holdings
 * Sequence:
 * 1. Fetch NFT holders
 * 2. Check social profiles
 * 3. Check eligible token holders one by one using Moralis (fallback to ethers.js if Moralis fails)
 * 4. Check for new social profiles after each token
 * 5. Calculate points for all eligible addresses with social profiles
 */
export async function calculateHolderPoints(): Promise<HolderPoints[]> {
  try {
    // Load leaderboard configuration
    const leaderboardConfig = loadLeaderboardConfig();
    
    // Map to track all addresses we've found
    const allAddresses = new Map<string, { 
      address: string,
      isEligible: boolean, // Whether this address meets any minimum balance requirement
      hasBeenCheckedForSocial: boolean, // Whether we've already checked for social profiles
      qualifiedBy: string[] // Which token/NFT qualified this address
    }>();
    
    // Map to track addresses with social profiles
    const addressesWithSocial = new Map<string, {
      address: string,
      twitterHandle: string,
      profileImageUrl: string | null
    }>();
    
    // Step 1: Fetch NFT holders
    console.log(`\nFetching NFT holders...`);
    
    const nftHolders = await fetchNftHoldersFromEthers(
      leaderboardConfig.weights.nfts[0].address,
      leaderboardConfig.weights.nfts[0].name,
      0 // Get all holders regardless of minimum balance
    );
    
    console.log(`Found ${nftHolders.length} NFT holders`);
    
    // Add NFT holders to our tracking map
    for (const holder of nftHolders) {
      const address = holder.address.toLowerCase();
      
      // Check if this holder meets the minimum balance requirement for the NFT
      const meetsMinBalance = holder.tokenCount >= leaderboardConfig.weights.nfts[0].minBalance;
      
      allAddresses.set(address, {
        address,
        isEligible: meetsMinBalance,
        hasBeenCheckedForSocial: false,
        qualifiedBy: meetsMinBalance ? [`${leaderboardConfig.weights.nfts[0].name} (${holder.tokenCount})`] : []
      });
    }
    
    // Step 2: Check social profiles for all NFT holders
    console.log(`\nFetching social profiles for ${allAddresses.size} NFT holders...`);
    
    const holdersToCheck = Array.from(allAddresses.values())
      .filter(info => !info.hasBeenCheckedForSocial)
      .map(info => ({
        address: info.address
      }));
    
    const addressToSocialInfo = await processHoldersWithSocials(
      holdersToCheck,
      '',
      'NFT holders',
      (holder, social) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null,
        twitter_pfp_url: social?.twitter_pfp_url || null
      })
    );
    
    // Update which addresses have been checked for social profiles
    for (const address of addressToSocialInfo.keys()) {
      if (allAddresses.has(address)) {
        allAddresses.get(address)!.hasBeenCheckedForSocial = true;
      }
    }
    
    // Add addresses with social profiles to our tracking map
    for (const [address, socialInfo] of addressToSocialInfo.entries()) {
      if (socialInfo.twitter_handle) {
        addressesWithSocial.set(address, {
          address,
          twitterHandle: socialInfo.twitter_handle,
          profileImageUrl: socialInfo.twitter_pfp_url
        });
      }
    }
    
    console.log(`\nFound ${addressesWithSocial.size} NFT holders with social profiles`);
    
    // Get all addresses we know about so far for potential fallback checks
    const allKnownAddresses = Array.from(allAddresses.keys());
    
    // Step 3 & 4: Check eligible token holders one by one using Moralis
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      console.log(`\nProcessing ${tokenWeight.symbol} token...`);
      
      try {
        // Try to fetch token holders from Moralis first
        console.log(`Fetching ${tokenWeight.symbol} holders from Moralis...`);
        
        let tokenHolders: TokenHolder[] = [];
        
        try {
          tokenHolders = await fetchTokenHoldersFromMoralis(
            tokenWeight.address,
            tokenWeight.symbol,
            18, // Assuming 18 decimals for all tokens
            tokenWeight.minBalance // Pass the minimum balance to filter holders
          );
          
          console.log(`Found ${tokenHolders.length} ${tokenWeight.symbol} holders with minimum balance of ${tokenWeight.minBalance}`);
        } catch (error) {
          console.error(`Error fetching ${tokenWeight.symbol} holders from Moralis:`, error);
          console.log(`Falling back to ethers.js for ${tokenWeight.symbol} holders...`);
          
          // Fallback to ethers.js - check all known addresses
          tokenHolders = await fetchTokenHoldersWithEthersFallback(
            tokenWeight.address,
            tokenWeight.symbol,
            allKnownAddresses,
            tokenWeight.minBalance
          );
        }
        
        // Add new qualifying addresses to our tracking map
        let newAddressesCount = 0;
        for (const holder of tokenHolders) {
          const address = holder.address.toLowerCase();
          
          if (!allAddresses.has(address)) {
            // This is a new address
            allAddresses.set(address, {
              address,
              isEligible: true,
              hasBeenCheckedForSocial: false,
              qualifiedBy: [`${tokenWeight.symbol} (${holder.balanceFormatted})`]
            });
            newAddressesCount++;
          } else {
            // This address was already known, mark it as eligible if it wasn't already
            const addressInfo = allAddresses.get(address)!;
            if (!addressInfo.isEligible) {
              addressInfo.isEligible = true;
              addressInfo.qualifiedBy.push(`${tokenWeight.symbol} (${holder.balanceFormatted})`);
              newAddressesCount++;
            } else if (!addressInfo.qualifiedBy.some(q => q.includes(tokenWeight.symbol))) {
              // Already eligible but not by this token
              addressInfo.qualifiedBy.push(`${tokenWeight.symbol} (${holder.balanceFormatted})`);
            }
          }
        }
        
        console.log(`Added ${newAddressesCount} new eligible addresses based on ${tokenWeight.symbol} balance`);
        
        // Check social profiles for new addresses we haven't checked yet
        const newAddressesToCheck = Array.from(allAddresses.values())
          .filter(info => !info.hasBeenCheckedForSocial)
          .map(info => ({
            address: info.address
          }));
        
        if (newAddressesToCheck.length > 0) {
          console.log(`\nFetching social profiles for ${newAddressesToCheck.length} new ${tokenWeight.symbol} holders...`);
          
          const newAddressToSocialInfo = await processHoldersWithSocials(
            newAddressesToCheck,
            '',
            `${tokenWeight.symbol} holders`,
            (holder, social) => ({
              ...holder,
              twitter_handle: social?.twitter_handle || null,
              twitter_pfp_url: social?.twitter_pfp_url || null
            })
          );
          
          // Update which addresses have been checked for social profiles
          for (const address of newAddressToSocialInfo.keys()) {
            if (allAddresses.has(address)) {
              allAddresses.get(address)!.hasBeenCheckedForSocial = true;
            }
          }
          
          // Add addresses with social profiles to our tracking map
          let newSocialCount = 0;
          for (const [address, socialInfo] of newAddressToSocialInfo.entries()) {
            if (socialInfo.twitter_handle && !addressesWithSocial.has(address)) {
              addressesWithSocial.set(address, {
                address,
                twitterHandle: socialInfo.twitter_handle,
                profileImageUrl: socialInfo.twitter_pfp_url
              });
              newSocialCount++;
            }
          }
          
          console.log(`Found ${newSocialCount} new ${tokenWeight.symbol} holders with social profiles`);
        }
      } catch (error) {
        console.error(`Error processing ${tokenWeight.symbol} token:`, error);
        console.log(`Continuing with next token...`);
      }
    }
    
    // Get eligible addresses with social profiles
    const eligibleAddressesWithSocial = Array.from(addressesWithSocial.keys())
      .filter(address => {
        const addressInfo = allAddresses.get(address);
        return addressInfo && addressInfo.isEligible;
      });
    
    console.log(`\nFound ${eligibleAddressesWithSocial.length} eligible addresses with social profiles`);
    
    // Step 5: Calculate points for all eligible addresses with social profiles
    const holderPointsMap = new Map<string, HolderPoints>();
    
    // Initialize holder points objects
    for (const address of eligibleAddressesWithSocial) {
      const socialInfo = addressesWithSocial.get(address)!;
      
      holderPointsMap.set(address, {
        address,
        twitterHandle: socialInfo.twitterHandle,
        profileImageUrl: socialInfo.profileImageUrl,
        totalPoints: 0,
        tokenPoints: {},
        nftPoints: {}
      });
    }
    
    // Calculate NFT points (only if minimum balance > 1)
    for (const nftWeight of leaderboardConfig.weights.nfts) {
      if (nftWeight.minBalance > 1) {
        console.log(`\nCalculating points for ${nftWeight.name} NFT...`);
        
        // Fetch NFT holders again (we need the token counts)
        const nftHolders = await fetchNftHoldersFromEthers(
          nftWeight.address,
          nftWeight.name,
          0 // Get all holders, we'll filter by minimum balance later
        );
        
        // Process NFT holders and calculate points
        for (const holder of nftHolders) {
          const address = holder.address.toLowerCase();
          
          if (holderPointsMap.has(address) && holder.tokenCount >= nftWeight.minBalance) {
            // Calculate points for this NFT
            const points = holder.tokenCount * nftWeight.pointsPerNft;
            
            // Update holder points
            const holderPoints = holderPointsMap.get(address)!;
            holderPoints.nftPoints[nftWeight.name] = points;
            holderPoints.totalPoints += points;
          }
        }
      } else {
        console.log(`\nSkipping ${nftWeight.name} NFT points calculation (minBalance = ${nftWeight.minBalance})`);
        
        // For NFTs with minBalance <= 1, use the holders we already have
        for (const holder of nftHolders) {
          const address = holder.address.toLowerCase();
          
          if (holderPointsMap.has(address) && holder.tokenCount >= nftWeight.minBalance) {
            // Calculate points for this NFT
            const points = holder.tokenCount * nftWeight.pointsPerNft;
            
            // Update holder points
            const holderPoints = holderPointsMap.get(address)!;
            holderPoints.nftPoints[nftWeight.name] = points;
            holderPoints.totalPoints += points;
          }
        }
      }
    }
    
    // Calculate token points using ethers.js
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      console.log(`\nCalculating points for ${tokenWeight.symbol}...`);
      
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
        
        if (holderPointsMap.has(address) && holder.balanceFormatted >= tokenWeight.minBalance) {
          // Calculate points for this token
          const points = holder.balanceFormatted * tokenWeight.pointsPerToken;
          
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
