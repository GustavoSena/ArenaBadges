import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

import { TokenHolder, NftHolder, ArenabookUserResponse } from '../../types/interfaces';
import { HolderPoints, Leaderboard } from '../../types/leaderboard';
import { BaseLeaderboard } from '../../types/leaderboard';
import { MuLeaderboard } from '../implementations/muLeaderboard';
import { StandardLeaderboard } from '../implementations/standardLeaderboard';
import { processHoldersWithSocials } from '../../services/socialProfiles';
import { saveLeaderboardHtml } from '../../utils/htmlGenerator';

// Import from API modules
import {
  fetchNftHoldersFromEthers,
  fetchTokenBalancesWithEthers
} from '../../api/blockchain';

// Import shared utility functions
import {
  saveLeaderboard,
  combineTokenHoldersByHandle,
  combineNftHoldersByHandle
} from '../utils/leaderboardUtils';
import { fetchTokenHolders } from '../../utils/helpers';
import { fetchTwitterProfilePicture } from '../../api/arenabook';
import { sleep } from '../../utils/helpers';
import { AppConfig } from '../../utils/config';

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

/**
 * Calculate points for each holder based on their token and NFT holdings
 * using the specified leaderboard implementation
 * @param leaderboard The leaderboard implementation to use
 * @param verbose Whether to show verbose logs
 * @returns Array of holder points
 */
export async function calculateHolderPoints(appConfig: AppConfig, leaderboard: BaseLeaderboard, verbose: boolean = false): Promise<HolderPoints[]> {
  try {
    // Load leaderboard configuration
    const leaderboardConfig = appConfig.leaderboardConfig;
    if (!leaderboardConfig) {
      throw new Error('Leaderboard configuration not found');
    }
    
    const leaderboardTokens = leaderboardConfig.weights.tokens;
    const leaderboardNfts = leaderboardConfig.weights.nfts;

    // Map to store holder points by address
    const holderPointsMap = new Map<string, HolderPoints>();
    
    // Cache for NFT holders by name to avoid duplicate fetching
    const nftHoldersByName = new Map<string, NftHolder[]>();
    
    // Step 1: Fetch NFT holders for eligibility check
    if (verbose) console.log('\nFetching NFT holders for eligibility check...');
    
    // Fetch all eligible NFT holders first
    const eligibleAddresses = new Set<string>();
    
    for (const nftWeight of leaderboardConfig.weights.nfts) {
      if (verbose) console.log(`Checking ${nftWeight.name} NFT holders...`);
      
      // Always use the fallback method (going through NFT IDs) instead of checking total supply
      const nftHolders = await fetchNftHoldersFromEthers(
        nftWeight.address,
        nftWeight.name,
        nftWeight.minBalance,
        verbose
      );
      
      // Store the NFT holders for later use
      nftHoldersByName.set(nftWeight.name, nftHolders);
      
      // Add eligible addresses
      for (const holder of nftHolders) {
        eligibleAddresses.add(holder.address.toLowerCase());
      }
    }
    
    // Step 2: Fetch token holders for eligibility check
    if (verbose) console.log('\nFetching token holders for eligibility check...');
    
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      if (verbose) console.log(`Fetching ${tokenWeight.symbol} token holders...`);
      
      // Calculate minimum balance for this token
      let minBalance = tokenWeight.minBalance;
      
      // For MU leaderboard, use dynamic minimum balance calculation
      if (leaderboard instanceof MuLeaderboard) {
        minBalance = await leaderboard.calculateDynamicMinimumBalance(
          tokenWeight.symbol,
          tokenWeight.minBalance,
          verbose
        );
      }
      
      // Fetch token holders directly from Moralis with minimum balance filter
      const tokenHolders = await fetchTokenHolders(
        tokenWeight.address,
        tokenWeight.symbol,
        tokenWeight.decimals || 18,
        minBalance,
        verbose
      );
      
      if (verbose) console.log(`Found ${tokenHolders.length} ${tokenWeight.symbol} token holders with minimum balance >= ${minBalance}`);
      
      // Add eligible addresses
      for (const holder of tokenHolders) {
        eligibleAddresses.add(holder.address.toLowerCase());
      }
    }
    
    console.log(`\nTotal eligible addresses: ${eligibleAddresses.size}`);
    
    // Convert eligible addresses to array
    const eligibleAddressesArray = Array.from(eligibleAddresses);
    
    // Extract project name from the leaderboard instance
    let projectName = appConfig.projectName;
    
    if (verbose) console.log(`Loading wallet mapping from mappings/${projectName}_wallet_mapping.json for social profile matching...`);
    
    let walletMapping: Record<string, string> = {};
    const walletMappingPath = path.join(process.cwd(), `config/mappings/${projectName}_wallet_mapping.json`);
    
    if (fs.existsSync(walletMappingPath)) {
      if (verbose) console.log(`Loading wallet mapping from path: ${walletMappingPath}`);
      try {
        const walletMappingData = fs.readFileSync(walletMappingPath, 'utf8');
        walletMapping = JSON.parse(walletMappingData);
        if (verbose) console.log(`Loaded ${Object.keys(walletMapping).length} wallet-to-handle mappings`);
      } catch (error) {
        console.error(`Error loading wallet mapping from ${walletMappingPath}:`, error);
      }
    } else if (verbose) {
      console.log(`No wallet mapping file found at ${walletMappingPath}`);
    }
    
    // Process holders with socials
    const socialProfiles = await processHoldersWithSocials(
      eligibleAddressesArray.map(address => ({ address })),
      (holder: { address: string }, social: ArenabookUserResponse | null) => ({
        address: holder.address,
        twitter_handle: social?.twitter_handle || null,
        twitter_pfp_url: social?.twitter_pfp_url || null
      }),
      walletMapping,
      verbose
    );
    
    // Step 4: Filter to addresses with social profiles
    if (verbose) console.log('\nFiltering to addresses with social profiles...');
    
    // Get addresses with social profiles
    const addressesWithSocial = new Set<string>();
    for (const [address, social] of socialProfiles.entries()) {
      if (social.twitter_handle) {
        addressesWithSocial.add(address.toLowerCase());
      }
    }

    console.log(`Addresses with social profiles: ${addressesWithSocial.size}`);
    
    // Step 5: Initialize holder points for addresses with social profiles
    if (verbose) console.log('\nInitializing holder points...');
    
    for (const address of addressesWithSocial) {
      const socialInfo = socialProfiles.get(address);
      
      if (socialInfo && socialInfo.twitter_handle) {
        holderPointsMap.set(address, {
          address,
          twitterHandle: socialInfo.twitter_handle.toLowerCase(),
          profileImageUrl: socialInfo.twitter_pfp_url || null,
          totalPoints: 0,
          tokenPoints: {},
          nftPoints: {}
        });
      }
    }
    
    // Check if sumOfBalances is enabled in the configuration
    const sumOfBalances = leaderboardConfig.sumOfBalances;
    if (verbose && sumOfBalances) {
      console.log('\nWallet combining is enabled (sumOfBalances=true)');
    }
    
    // Create a mapping of Twitter handles to wallet addresses
    const handleToWallet: Record<string, string> = {};
    for (const [address, social] of socialProfiles.entries()) {
      if (social.twitter_handle) {
        handleToWallet[social.twitter_handle.toLowerCase()] = address.toLowerCase();
      }
    }
    
    // Step 6: Calculate token points
    if (verbose) console.log('\nCalculating token points...');
    
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      if (verbose) console.log(`\nCalculating points for ${tokenWeight.symbol}...`);
      
      // Get addresses with social profiles
      const addressesToCheck = Array.from(addressesWithSocial);
      
      // Fetch token balances for addresses with social profiles
      let tokenHolders = await fetchTokenBalancesWithEthers(
        tokenWeight.address,
        tokenWeight.symbol,
        addressesToCheck,
        tokenWeight.decimals || 18,
        verbose
      );
      
      // Combine token holders by Twitter handle if sumOfBalances is enabled
      if (sumOfBalances) {
        if (verbose) console.log(`Combining token holders by Twitter handle for ${tokenWeight.symbol}...`);
        
        // Combine token holders by Twitter handle
        tokenHolders = await combineTokenHoldersByHandle(
          tokenHolders,
          walletMapping,
          verbose
        );
        
        if (verbose) console.log(`After combining, found ${tokenHolders.length} ${tokenWeight.symbol} token holders`);
      }
      
      // Process token holders and calculate points
      for (const holder of tokenHolders) {
        const address = holder.address.toLowerCase();
        
        if (holderPointsMap.has(address)) {
          // Get holder points
          const holderPoints = holderPointsMap.get(address)!;
          
          // Calculate points using the leaderboard implementation
          const points = await leaderboard.calculatePoints([holder], [], leaderboardTokens, leaderboardNfts);
          
          // Update holder points
          holderPoints.tokenPoints[tokenWeight.symbol] = points;
          holderPoints.totalPoints += points;
          
          if (verbose) console.log(`${address}: ${tokenWeight.symbol} = ${points} points`);
        }
      }
    }
    
    // Step 7: Calculate NFT points
    if (verbose) console.log('\nCalculating NFT points...');
    
    for (const nftWeight of leaderboardConfig.weights.nfts) {
      if (verbose) console.log(`\nCalculating points for ${nftWeight.name}...`);
      
      // Get the cached NFT holders
      let nftHolders = nftHoldersByName.get(nftWeight.name) || [];
      
      // Combine NFT holders by Twitter handle if sumOfBalances is enabled
      if (sumOfBalances) {
        if (verbose) console.log(`Combining NFT holders by Twitter handle for ${nftWeight.name}...`);
        
        // Maps to store Twitter handle information
        const twitterHandleMap = new Map<string, string>();
        const combinedAddressesMap = new Map<string, string[]>();
        
        // Combine NFT holders by Twitter handle
        nftHolders = await combineNftHoldersByHandle(
          nftHolders,
          walletMapping,
          handleToWallet,
          nftWeight.minBalance || 0,
          sumOfBalances,
          twitterHandleMap,
          combinedAddressesMap,
          verbose
        );
        
        if (verbose) console.log(`After combining, found ${nftHolders.length} ${nftWeight.name} NFT holders`);
      }
      
      // Process NFT holders and calculate points
      for (const holder of nftHolders) {
        const address = holder.address.toLowerCase();
        
        if (holderPointsMap.has(address) && holder.tokenCount >= nftWeight.minBalance) {
          // Get holder points
          const holderPoints = holderPointsMap.get(address)!;
          
          // Check eligibility using the leaderboard implementation
          const isEligible = await leaderboard.checkEligibility([], [holder], leaderboardTokens, leaderboardNfts);
          
          if (isEligible) {
            // Calculate points using the leaderboard implementation
            const points = await leaderboard.calculatePoints([], [holder], leaderboardTokens, leaderboardNfts);
            
            // Update holder points
            holderPoints.nftPoints[nftWeight.name] = points;
            holderPoints.totalPoints += points;
            
            if (verbose) console.log(`${address}: ${nftWeight.name} = ${points} points`);
          }
        }
      }
    }
    
    // Step 8: Filter out holders with zero points
    if (verbose) console.log('\nFiltering out holders with zero points...');
    
    const holderPoints = Array.from(holderPointsMap.values()).filter(holder => holder.totalPoints > 0);
    
    if (verbose) console.log(`Final holder count: ${holderPoints.length}`);
    else console.log(`Final holder count: ${holderPoints.length}`);
    
    return holderPoints;
  } catch (error) {
    console.error('Error calculating holder points:', error);
    throw error;
  }
}


/**
 * Fetch Twitter profile pictures for leaderboard entries that don't have one
 * @param leaderboard The leaderboard to update
 * @param verbose Whether to log verbose output
 * @returns The updated leaderboard
 */
async function fetchProfilePicturesForLeaderboard(leaderboard: Leaderboard, verbose: boolean = false): Promise<Leaderboard> {
  if (verbose) console.log('\nFetching Twitter profile pictures for leaderboard entries...');
  
  let updatedCount = 0;
  const batchSize = 10;
  
  // Process entries in batches to avoid rate limiting
  for (let i = 0; i < leaderboard.entries.length; i += batchSize) {
    const batch = leaderboard.entries.slice(i, i + batchSize);
    const batchPromises = [];
    
    for (const entry of batch) {
      // Only process entries that have a Twitter handle but no profile picture
      if (entry.twitterHandle && !entry.profileImageUrl) {
        batchPromises.push((async () => {
          try {
            if (verbose) console.log(`Fetching profile picture for ${entry.twitterHandle}...`);
            const profilePicture = await fetchTwitterProfilePicture(entry.twitterHandle);
            
            if (profilePicture) {
              entry.profileImageUrl = profilePicture;
              updatedCount++;
              if (verbose) console.log(`Found profile picture for ${entry.twitterHandle}`);
            } else if (verbose) {
              console.log(`No profile picture found for ${entry.twitterHandle}`);
            }
          } catch (error) {
            console.error(`Error fetching profile picture for ${entry.twitterHandle}:`, error);
          }
        })());
      }
    }
    
    // Wait for all promises in the batch to complete
    await Promise.all(batchPromises);
    
    // Log progress
    if (verbose && i + batchSize < leaderboard.entries.length) {
      console.log(`Processed ${i + batchSize} of ${leaderboard.entries.length} entries (${updatedCount} profile pictures added)`);
    }
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < leaderboard.entries.length) {
      await sleep(500);
    }
  }
  
  console.log(`Added ${updatedCount} Twitter profile pictures to leaderboard entries`);
  return leaderboard;
}

/**
 * Generate and save MU leaderboard
 * @param verbose Whether to log verbose output
 */
export async function generateAndSaveMuLeaderboard(appConfig: AppConfig, verbose: boolean = false): Promise<Leaderboard> {
  try {
    if (verbose) {
      console.log('Starting MU leaderboard generation...');
    }
    
    const leaderboardConfig = appConfig.leaderboardConfig;
    if (!leaderboardConfig) {
      throw new Error('Leaderboard configuration not found');
    }
    
    // Create MuLeaderboard instance
    const muLeaderboard = new MuLeaderboard(provider, leaderboardConfig.excludedAccounts);
    
      console.log('Calculating holder points...');
    
    const holderPoints = await calculateHolderPoints(appConfig, muLeaderboard, verbose);
    
    
    if (verbose) {
      console.log('Loaded MU leaderboard configuration');
    }
    
    console.log('Generating leaderboard...');
    
    const leaderboard = muLeaderboard.generateLeaderboard(holderPoints, 0);
    
    if (verbose) {
      console.log(`Generated MU leaderboard with ${leaderboard.entries.length} entries`);
    }
    
    // Fetch Twitter profile pictures for entries that don't have one
    await fetchProfilePicturesForLeaderboard(leaderboard, verbose);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'output', 'leaderboards');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      if (verbose) {
        console.log(`Created output directory: ${outputDir}`);
      }
    }
    
    // Save leaderboard to JSON file
    const jsonOutputPath = path.join(outputDir, muLeaderboard.getOutputFileName());
    saveLeaderboard(leaderboard, jsonOutputPath);
    
    if (verbose) {
      console.log(`Saved MU leaderboard JSON to ${jsonOutputPath}`);
    }
    
    // Save leaderboard to HTML file with index.html filename
    const htmlOutputPath = path.join(outputDir, 'index.html');
    saveLeaderboardHtml(leaderboard, htmlOutputPath, leaderboardConfig.output);
    
    if (verbose) {
      console.log(`Saved MU leaderboard HTML to ${htmlOutputPath}`);
    }
    
    // Copy logo file to assets directory if specified in config
    if (leaderboardConfig.output && leaderboardConfig.output.logoPath) {
      const assetsDir = path.join(outputDir, 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        if (verbose) {
          console.log(`Created assets directory: ${assetsDir}`);
        }
      }
      
      // Copy logo file
      const logoSource = path.join(process.cwd(), 'assets', leaderboardConfig.output.logoPath);
      const logoTarget = path.join(assetsDir, leaderboardConfig.output.logoPath);
      fs.copyFileSync(logoSource, logoTarget);
      
      if (verbose) {
        console.log(`Copied logo from ${logoSource} to ${logoTarget}`);
      }
    }
    
    // Print total number of entries
    console.log(`MU leaderboard generated and saved to ${outputDir}`);
    console.log(`Total entries: ${leaderboard.entries.length}`);
    
    return leaderboard;
  } catch (error) {
    console.error('Error generating MU leaderboard:', error);
    throw error;
  }
}

/**
 * Generate and save standard leaderboard
 * @param verbose Whether to log verbose output
 */
export async function generateAndSaveStandardLeaderboard(appConfig: AppConfig, verbose: boolean = false): Promise<Leaderboard> {
  try {
    if (verbose) {
      console.log('Starting standard leaderboard generation...');
    }
    
    const leaderboardConfig = appConfig.leaderboardConfig;
    if (!leaderboardConfig) {
      throw new Error('Leaderboard configuration not found');
    }
    
    // Create StandardLeaderboard instance
    const standardLeaderboard = new StandardLeaderboard(provider, leaderboardConfig.excludedAccounts);
    
    // Calculate holder points
    if (verbose) {
      console.log('Calculating holder points using StandardLeaderboard implementation...');
    } else {
      console.log('Calculating holder points...');
    }
    
    const holderPoints = await calculateHolderPoints(appConfig, standardLeaderboard, verbose);
    
    if (verbose) {
      console.log('Loaded standard leaderboard configuration');
    }
    
    // Generate leaderboard - include all entries (pass 0 for maxEntries)
    if (verbose) {
      console.log('Generating standard leaderboard...');
    } else {
      console.log('Generating leaderboard...');
    }
    
    const leaderboard = standardLeaderboard.generateLeaderboard(holderPoints, 0);
    
    if (verbose) {
      console.log(`Generated standard leaderboard with ${leaderboard.entries.length} entries`);
    }
    
    // Fetch Twitter profile pictures for entries that don't have one
    await fetchProfilePicturesForLeaderboard(leaderboard, verbose);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'output', 'leaderboards');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      if (verbose) {
        console.log(`Created output directory: ${outputDir}`);
      }
    }
    
    // Save leaderboard to JSON file
    const jsonOutputPath = path.join(outputDir, standardLeaderboard.getOutputFileName());
    saveLeaderboard(leaderboard, jsonOutputPath);
    
    if (verbose) {
      console.log(`Saved standard leaderboard JSON to ${jsonOutputPath}`);
    }
    
    // Save leaderboard to HTML file
    const htmlOutputPath = jsonOutputPath.replace('.json', '.html');
    saveLeaderboardHtml(leaderboard, htmlOutputPath, leaderboardConfig.output);
    
    if (verbose) {
      console.log(`Saved standard leaderboard HTML to ${htmlOutputPath}`);
    }
    
    // Copy logo file to assets directory if specified in config
    if (leaderboardConfig.output && leaderboardConfig.output.logoPath) {
      const assetsDir = path.join(outputDir, 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        if (verbose) {
          console.log(`Created assets directory: ${assetsDir}`);
        }
      }
      
      // Copy logo file
      const logoSource = path.join(process.cwd(), 'assets', leaderboardConfig.output.logoPath);
      const logoTarget = path.join(assetsDir, leaderboardConfig.output.logoPath);
      fs.copyFileSync(logoSource, logoTarget);
      
      if (verbose) {
        console.log(`Copied logo from ${logoSource} to ${logoTarget}`);
      }
    }
    
    // Print total number of entries
    console.log(`Standard leaderboard generated and saved to ${outputDir}`);
    console.log(`Total entries: ${leaderboard.entries.length}`);
    
    return leaderboard;
  } catch (error) {
    console.error('Error generating standard leaderboard:', error);
    throw error;
  }
}
