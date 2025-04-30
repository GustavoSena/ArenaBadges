import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

import { TokenHolder, NftHolder } from '../../types/interfaces';
import { LeaderboardConfig, HolderPoints, Leaderboard } from '../../types/leaderboard';
import { BaseLeaderboard } from '../../types/leaderboardClasses';
import { MuLeaderboard } from '../../implementations/leaderboards/muLeaderboard';
import { StandardLeaderboard } from '../../implementations/leaderboards/standardLeaderboard';
import { fetchNftHoldersFromEthers, fetchNftHoldersWithoutTotalSupply } from '../../api/blockchain';
import { fetchTokenHoldersFromMoralis } from '../../api/moralis';
import { processHoldersWithSocials, SocialProfileInfo } from '../../services/socialProfiles';
import { saveLeaderboardHtml } from '../../utils/htmlGenerator';
import { formatTokenBalance, sleep } from '../../utils/helpers';

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
    
    // Convert to formatted balance using our safe formatter
    return formatTokenBalance(balance.toString(), tokenDecimals);
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
  tokenDecimals: number,
  verbose: boolean = false
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = [];
  let processedCount = 0;
  
  if (verbose) console.log(`Fetching ${tokenSymbol} balances for ${holderAddresses.length} addresses using ethers.js...`);
  
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
          const balance = await fetchTokenBalanceWithEthers(tokenAddress, address, tokenDecimals);
          
          return {
            address,
            balance: ethers.parseUnits(balance.toString(), tokenDecimals).toString(),
            balanceFormatted: balance,
            tokenSymbol
          };
        } catch (error) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            if (verbose) console.log(`Error fetching balance for ${address}. Retry ${retryCount}/${MAX_RETRIES}...`);
            // Add a small delay before retrying
            await sleep(1000);
          } else {
            if (verbose) console.error(`Failed after ${MAX_RETRIES} retries for address ${address}`);
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
      if (verbose) console.log(`Processed ${processedCount}/${holderAddresses.length} addresses...`);
    }
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < holderAddresses.length) {
      await sleep(500);
    }
  }
  
  // Count non-zero balances for logging
  const nonZeroBalances = holders.filter(h => h.balanceFormatted > 0).length;
  if (verbose) console.log(`Found ${nonZeroBalances} addresses with non-zero ${tokenSymbol} balance`);
  
  return holders;
}

/**
 * Process holders with socials
 * @param eligibleAddressesArray Array of eligible addresses
 * @param outputPath Path to save the output
 * @param processingName Name of the processing
 * @param verbose Whether to show verbose logs
 * @returns Map of addresses to social info
 */
async function processHoldersWithSocialsWrapper(
  eligibleAddressesArray: { address: string }[],
  outputPath: string,
  processingName: string,
  verbose: boolean = false
): Promise<Map<string, SocialProfileInfo>> {
  return processHoldersWithSocials(
    eligibleAddressesArray,
    outputPath,
    processingName,
    (holder, social) => ({
      address: holder.address,
      twitter_handle: social?.twitter_handle || null,
      twitter_pfp_url: social?.twitter_pfp_url || null
    }),
    verbose
  );
}

/**
 * Calculate points for each holder based on their token and NFT holdings
 * using the specified leaderboard implementation
 * @param leaderboard The leaderboard implementation to use
 * @param verbose Whether to show verbose logs
 * @returns Array of holder points
 */
export async function calculateHolderPoints(leaderboard: BaseLeaderboard, verbose: boolean = false): Promise<HolderPoints[]> {
  try {
    // Load leaderboard configuration
    const leaderboardConfig = leaderboard.loadConfig();
    
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
      const nftHolders = await fetchNftHoldersWithoutTotalSupply(
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
    
    // Get MUG/MU price for dynamic minimum balance calculations
    let mugMuPrice = 30; // Default fallback value
    if (leaderboard instanceof MuLeaderboard) {
      mugMuPrice = await leaderboard.getMugMuPrice();
      if (verbose) console.log(`Using MUG/MU price: ${mugMuPrice} for dynamic minimum balances`);
    }
    
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      if (verbose) console.log(`Fetching ${tokenWeight.symbol} token holders...`);
      
      // Calculate dynamic minimum balance for this token
      let minBalance = tokenWeight.minBalance;
      
      // For tokens with dynamic minimum balances, calculate the correct value
      if (leaderboard instanceof MuLeaderboard && tokenWeight.minBalance === 0) {
        switch (tokenWeight.symbol) {
          case 'MU':
            minBalance = 100;
            break;
          case 'MUG':
            minBalance = 100 / mugMuPrice;
            break;
          case 'MUO':
            minBalance = 100 / (1.1 * mugMuPrice);
            break;
          case 'MUV':
            minBalance = 100 / (10 * 1.1 * mugMuPrice);
            break;
        }
        
        if (verbose) {
          console.log(`Using dynamic minimum balance for ${tokenWeight.symbol}: ${minBalance}`);
        }
      }
      
      // Fetch token holders directly from Moralis with minimum balance filter
      const tokenHolders = await fetchTokenHoldersFromMoralis(
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
    
    if (verbose) console.log(`\nTotal eligible addresses: ${eligibleAddresses.size}`);
    else console.log(`Total eligible addresses: ${eligibleAddresses.size}`);
    
    // Step 3: Fetch social profiles for eligible addresses
    if (verbose) console.log('\nFetching social profiles for eligible addresses...');
    
    // Convert eligible addresses to array
    const eligibleAddressesArray = Array.from(eligibleAddresses);
    
    // Process holders with socials
    const socialProfiles = await processHoldersWithSocialsWrapper(
      eligibleAddressesArray.map(address => ({ address })),
      path.join(__dirname, '../../output/social_profiles.json'),
      'Eligible Holders',
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
    
    if (verbose) console.log(`Found ${addressesWithSocial.size} addresses with social profiles`);
    else console.log(`Addresses with social profiles: ${addressesWithSocial.size}`);
    
    // Step 5: Initialize holder points for addresses with social profiles
    if (verbose) console.log('\nInitializing holder points...');
    
    for (const address of addressesWithSocial) {
      const socialInfo = socialProfiles.get(address);
      
      if (socialInfo && socialInfo.twitter_handle) {
        holderPointsMap.set(address, {
          address,
          twitterHandle: socialInfo.twitter_handle,
          profileImageUrl: socialInfo.twitter_pfp_url || null,
          totalPoints: 0,
          tokenPoints: {},
          nftPoints: {}
        });
      }
    }
    
    // Step 6: Calculate token points
    if (verbose) console.log('\nCalculating token points...');
    
    for (const tokenWeight of leaderboardConfig.weights.tokens) {
      if (verbose) console.log(`\nCalculating points for ${tokenWeight.symbol}...`);
      
      // Get addresses with social profiles
      const addressesToCheck = Array.from(addressesWithSocial);
      
      // Fetch token balances for addresses with social profiles
      const tokenHolders = await fetchTokenBalancesWithEthers(
        tokenWeight.address,
        tokenWeight.symbol,
        addressesToCheck,
        tokenWeight.decimals || 18,
        verbose
      );
      
      // Process token holders and calculate points
      for (const holder of tokenHolders) {
        const address = holder.address.toLowerCase();
        
        if (holderPointsMap.has(address)) {
          // Get holder points
          const holderPoints = holderPointsMap.get(address)!;
          
          // Calculate points for this token
          const tokenHoldings = [holder];
          
          // Calculate points using the leaderboard implementation
          const points = await leaderboard.calculatePoints(tokenHoldings, []);
          
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
      const nftHolders = nftHoldersByName.get(nftWeight.name) || [];
      
      // Process NFT holders and calculate points
      for (const holder of nftHolders) {
        const address = holder.address.toLowerCase();
        
        if (holderPointsMap.has(address) && holder.tokenCount >= nftWeight.minBalance) {
          // Get holder points
          const holderPoints = holderPointsMap.get(address)!;
          
          // Calculate points for this NFT using the leaderboard implementation
          const tokenHoldings: TokenHolder[] = [];
          const nftHoldings = [holder];
          
          // Check eligibility using the leaderboard implementation
          const isEligible = await leaderboard.checkEligibility(tokenHoldings, nftHoldings);
          
          if (isEligible) {
            // Calculate points using the leaderboard implementation
            const points = await leaderboard.calculatePoints([], nftHoldings);
            
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
 * @param verbose Whether to show verbose logs
 */
export async function generateAndSaveMuLeaderboard(verbose: boolean = false): Promise<Leaderboard> {
  try {
    // Create MuLeaderboard instance
    const muLeaderboard = new MuLeaderboard(provider);
    
    // Calculate holder points
    console.log('Calculating holder points using MuLeaderboard implementation...');
    const holderPoints = await calculateHolderPoints(muLeaderboard, verbose);
    
    // Get the config
    const config = muLeaderboard.loadConfig();
    
    // Generate leaderboard - include all entries (pass 0 for maxEntries)
    console.log('Generating leaderboard...');
    const leaderboard = muLeaderboard.generateLeaderboard(holderPoints, 0);
    
    // Save leaderboard to JSON file
    const outputDir = path.join(__dirname, '../../output/leaderboards');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const jsonOutputPath = path.join(outputDir, muLeaderboard.getOutputFileName());
    saveLeaderboard(leaderboard, jsonOutputPath);
    
    // Save leaderboard to HTML file in output directory
    const htmlFileName = muLeaderboard.getOutputFileName().replace('.json', '.html');
    const htmlOutputPath = path.join(outputDir, htmlFileName);
    saveLeaderboardHtml(leaderboard, htmlOutputPath, config.output);
    
    // Also save leaderboard to public directory for the web server
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const publicHtmlPath = path.join(publicDir, 'mu_leaderboard.html');
    saveLeaderboardHtml(leaderboard, publicHtmlPath, config.output);
    
    // Print total number of entries
    console.log(`Total entries: ${leaderboard.entries.length}`);
    console.log(`JSON saved to: ${jsonOutputPath}`);
    console.log(`HTML saved to: ${htmlOutputPath}`);
    console.log(`Leaderboard HTML also saved to ${publicHtmlPath} for web server access`);
    
    return leaderboard;
  } catch (error) {
    console.error('Error generating and saving leaderboard:', error);
    throw error;
  }
}

/**
 * Generate and save a leaderboard using the StandardLeaderboard implementation
 * @param verbose Whether to show verbose logs
 */
export async function generateAndSaveStandardLeaderboard(verbose: boolean = false): Promise<Leaderboard> {
  try {
    // Create StandardLeaderboard instance
    const standardLeaderboard = new StandardLeaderboard(provider);
    
    // Calculate holder points
    console.log('Calculating holder points using StandardLeaderboard implementation...');
    const holderPoints = await calculateHolderPoints(standardLeaderboard, verbose);
    
    // Get the config
    const config = standardLeaderboard.loadConfig();
    
    // Generate leaderboard - include all entries (pass 0 for maxEntries)
    console.log('Generating leaderboard...');
    const leaderboard = standardLeaderboard.generateLeaderboard(holderPoints, 0);
    
    // Save leaderboard to JSON file
    const outputDir = path.join(__dirname, '../../output/leaderboards');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const jsonOutputPath = path.join(outputDir, standardLeaderboard.getOutputFileName());
    saveLeaderboard(leaderboard, jsonOutputPath);
    
    // Save leaderboard to HTML file in output directory
    const htmlFileName = standardLeaderboard.getOutputFileName().replace('.json', '.html');
    const htmlOutputPath = path.join(outputDir, htmlFileName);
    saveLeaderboardHtml(leaderboard, htmlOutputPath, config.output);
    
    // Also save leaderboard to public directory for the web server
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const publicHtmlPath = path.join(publicDir, 'standard_leaderboard.html');
    saveLeaderboardHtml(leaderboard, publicHtmlPath, config.output);
    
    // Print total number of entries
    console.log(`Total entries: ${leaderboard.entries.length}`);
    console.log(`JSON saved to: ${jsonOutputPath}`);
    console.log(`HTML saved to: ${htmlOutputPath}`);
    console.log(`Leaderboard HTML also saved to ${publicHtmlPath} for web server access`);
    
    return leaderboard;
  } catch (error) {
    console.error('Error generating and saving leaderboard:', error);
    throw error;
  }
}
