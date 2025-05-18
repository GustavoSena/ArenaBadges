import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

import { TokenHolding, NftHolding, AddressHoldings } from '../../types/interfaces';
import { HolderEntry, Leaderboard } from '../../types/leaderboard';
import { BaseLeaderboard } from '../../types/leaderboard';
import { MuLeaderboard } from '../implementations/muLeaderboard';
import { StandardLeaderboard } from '../implementations/standardLeaderboard';
import { saveLeaderboardHtml } from '../../utils/htmlGenerator';

// Import from API modules
import {
  fetchNftHoldersFromEthers,
  fetchTokenBalanceWithEthers
} from '../../api/blockchain';

// Import shared utility functions
import {
  saveLeaderboard  
} from '../utils/leaderboardUtils';
import { fetchTokenHolders } from '../../utils/helpers';
import { fetchTwitterProfilePicture } from '../../api/arenabook';
import { sleep } from '../../utils/helpers';
import { AppConfig } from '../../utils/config';
import { loadWalletMapping } from '../../utils/walletMapping';
import { fetchArenabookSocial } from '../../api/arenabook';

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
 * @param appConfig The application configuration
 * @param leaderboard The leaderboard implementation to use
 * @param verbose Whether to show verbose logs
 * @returns Array of holder points
 */
export async function calculateHolderPoints(appConfig: AppConfig, leaderboard: BaseLeaderboard, verbose: boolean = false): Promise<HolderEntry[]> {
  try {
    // Load leaderboard configuration
    const leaderboardConfig = appConfig.leaderboardConfig;
    if (!leaderboardConfig) {
      throw new Error('Leaderboard configuration not found');
    }
    
    const leaderboardTokens = leaderboardConfig.weights.tokens;
    const leaderboardNfts = leaderboardConfig.weights.nfts;
    const sumOfBalances = leaderboardConfig.sumOfBalances;

    if (verbose) console.log(`Sum of balances feature is ${sumOfBalances ? 'enabled' : 'disabled'} for leaderboard`);
    
    // Step 1: Create mappings to store token and NFT holdings for each wallet
    const walletToTokenHoldings = new Map<string, Map<string, TokenHolding>>();
    const walletToNftHoldings = new Map<string, Map<string, NftHolding>>();
    
    // Step 2: Fetch NFT holders
    if (verbose) console.log('\nFetching NFT holders...');
    
    for (const nftConfig of leaderboardNfts) {
      let minNftBalance = await leaderboard.calculateDynamicMinimumBalance(nftConfig.name);
      if (sumOfBalances) {
        minNftBalance = Math.ceil(minNftBalance * 0.5);
      }
      if (verbose) console.log(`Fetching ${nftConfig.name} NFT holders (min balance: ${minNftBalance})...`);
      
      const nftHolders = await fetchNftHoldersFromEthers(
        nftConfig.address,
        nftConfig.name,
        minNftBalance,
        verbose,
        nftConfig.collectionSize
      );
      if (verbose) console.log(`Found ${nftHolders.length} ${nftConfig.name} NFT holders`);
      
      // Add NFT holdings to the mapping
      for (const holder of nftHolders) {
        const address = holder.address.toLowerCase();
        
        // Initialize NFT holdings map for this wallet if it doesn't exist
        if (!walletToNftHoldings.has(address)) {
          walletToNftHoldings.set(address, new Map<string, NftHolding>());
        }
        
        // Create NFT holding
        const nftHolding: NftHolding = {
          tokenAddress: nftConfig.address,
          tokenSymbol: nftConfig.name,
          tokenBalance: holder.tokenCount.toString()
        };
        
        // Add to wallet's NFT holdings
        walletToNftHoldings.get(address)!.set(nftConfig.name, nftHolding);
      }
    }
    
    // Step 3: Fetch token holders
    if (verbose) console.log('\nFetching token holders...');
    
    for (const tokenConfig of leaderboardTokens) {
      let minTokenBalance = await leaderboard.calculateDynamicMinimumBalance(tokenConfig.symbol);
      if (sumOfBalances) {
        minTokenBalance = minTokenBalance * 0.5;
      }
      if (verbose) 
        console.log(`Fetching ${tokenConfig.symbol} token holders (min balance: ${minTokenBalance})...`);
      
      const tokenHolders = await fetchTokenHolders(
        tokenConfig.address,
        tokenConfig.symbol,
        tokenConfig.decimals,
        minTokenBalance,
        verbose
      );
      
      if (verbose) console.log(`Found ${tokenHolders.length} ${tokenConfig.symbol} token holders`);
      
      // Add token holdings to the mapping
      for (const holder of tokenHolders) {
        const address = holder.address.toLowerCase();
        
        // Initialize token holdings map for this wallet if it doesn't exist
        if (!walletToTokenHoldings.has(address)) {
          walletToTokenHoldings.set(address, new Map<string, TokenHolding>());
        }
        
        // Create token holding
        const tokenHolding: TokenHolding = {
          tokenAddress: tokenConfig.address,
          tokenSymbol: tokenConfig.symbol,
          tokenBalance: holder.balance,
          tokenDecimals: tokenConfig.decimals
        };
        
        // Add to wallet's token holdings
        walletToTokenHoldings.get(address)!.set(tokenConfig.symbol, tokenHolding);
      }
    }
    
    // Step 4: Create a map of twitter_handle -> AddressHoldings[]
    const userHoldings = new Map<string, AddressHoldings[]>();
    
    // Step 5: Check which wallets are in the wallet mapping file
    if (verbose) console.log('\nProcessing wallet mappings...');
    
    // Load wallet mapping if available
    const walletMappingFile = appConfig.projectConfig.walletMappingFile;
    if (walletMappingFile) {
      if (verbose) console.log(`Loading wallet mapping from ${walletMappingFile}...`);
      
      const walletMapping = loadWalletMapping(walletMappingFile);
      
      if (verbose) console.log(`Loaded ${Object.keys(walletMapping).length} wallet mappings`);
      
      // Process wallets from mapping
      for (const [address, handle] of Object.entries(walletMapping)) {
        const lowerAddress = address.toLowerCase();
        const lowerHandle = handle.toLowerCase();
        
        // Initialize user holdings array if it doesn't exist
        if (!userHoldings.has(lowerHandle)) {
          userHoldings.set(lowerHandle, []);
        }
        
        // Create address holdings object
        const addressHoldings: AddressHoldings = {
          address: lowerAddress,
          nftHoldings: {},
          tokenHoldings: {},
          fromMapping: true
        };
        
        // Add NFT holdings if available
        if (walletToNftHoldings.has(lowerAddress)) {
          const nftHoldings = walletToNftHoldings.get(lowerAddress)!;
          for (const [name, holding] of nftHoldings.entries()) {
            addressHoldings.nftHoldings[name] = holding;
          }
        }
        
        // Add token holdings if available
        if (walletToTokenHoldings.has(lowerAddress)) {
          const tokenHoldings = walletToTokenHoldings.get(lowerAddress)!;
          for (const [symbol, holding] of tokenHoldings.entries()) {
            addressHoldings.tokenHoldings[symbol] = holding;
          }
        }
        
        // Add to user holdings
        userHoldings.get(lowerHandle)!.push(addressHoldings);
      }
    } else {
      if (verbose) console.log('No wallet mapping file specified');
    }
    
    // Step 6: For remaining wallets, fetch Arena profiles
    if (verbose) console.log('\nFetching Arena profiles for remaining wallets...');
    
    // Create a set of addresses that have been processed
    const processedAddresses = new Set<string>();
    
    // Mark addresses from wallet mapping as processed
    if (walletMappingFile) {
      const walletMapping = await loadWalletMapping(walletMappingFile);
      for (const address of Object.keys(walletMapping)) {
        processedAddresses.add(address.toLowerCase());
      }
    }
    
    // Get all addresses from token and NFT holdings
    const allAddresses = new Set<string>([...walletToTokenHoldings.keys(), ...walletToNftHoldings.keys()]);
    
    // Process addresses that haven't been processed yet
    const addressesToProcess = Array.from(allAddresses)
      .filter(address => !processedAddresses.has(address));
    
    if (verbose) console.log(`Fetching Arena profiles for ${addressesToProcess.length} addresses...`);
    
    // Process addresses in batches to improve performance and avoid rate limiting
    const BATCH_SIZE = 5;
    const REQUEST_DELAY_MS = 1000; // 500ms delay between requests
    
    const arenaPictureMapping = new Map<string, string>();
    for (let i = 0; i < addressesToProcess.length; i += BATCH_SIZE) {
      const batch = addressesToProcess.slice(i, i + BATCH_SIZE);
      
      if (verbose) {
        console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(addressesToProcess.length / BATCH_SIZE)}...`);
      }
      
      // Process wallets in parallel with rate limiting
      const promises = batch.map(async (address) => {
        try {
          // Fetch Arena profile for this wallet
          const social = await fetchArenabookSocial(address);
          
          // Skip wallets without a Twitter handle
          if (!social || !social.twitter_handle) {
            if (verbose) {
              console.log(`No Twitter handle found for wallet ${address}, skipping...`);
            }
            return;
          }
          
          const lowerHandle = social.twitter_handle.toLowerCase();
          if(social.twitter_pfp_url)
            arenaPictureMapping.set(lowerHandle, social.twitter_pfp_url);

          // Initialize user holdings array if it doesn't exist
          if (!userHoldings.has(lowerHandle)) {
            userHoldings.set(lowerHandle, []);
          }
          
          // If sumOfBalances is false and we already have this Twitter handle, skip
          if (!sumOfBalances && userHoldings.has(lowerHandle) && userHoldings.get(lowerHandle)!.length > 0) {
            if (verbose) {
              console.log(`Twitter handle ${lowerHandle} already exists and sumOfBalances is disabled, skipping wallet ${address}...`);
            }
            return;
          }
          
          // Create address holdings object
          const addressHoldings: AddressHoldings = {
            address,
            nftHoldings: {},
            tokenHoldings: {},
            fromMapping: false
          };
          
          // Add NFT holdings if available
          if (walletToNftHoldings.has(address)) {
            const nftHoldings = walletToNftHoldings.get(address)!;
            for (const [name, holding] of nftHoldings.entries()) {
              addressHoldings.nftHoldings[name] = holding;
            }
          }
          
          // Add token holdings if available
          if (walletToTokenHoldings.has(address)) {
            const tokenHoldings = walletToTokenHoldings.get(address)!;
            for (const [symbol, holding] of tokenHoldings.entries()) {
              addressHoldings.tokenHoldings[symbol] = holding;
            }
          }
          
          // Add to user holdings
          userHoldings.get(lowerHandle)!.push(addressHoldings);
        } catch (error) {
          console.error(`Error processing wallet ${address}:`, error);
        }
        
        // Add delay between requests to avoid rate limiting
        await sleep(REQUEST_DELAY_MS);
      });
      
      // Wait for all promises in this batch to complete before moving to the next batch
      await Promise.all(promises);
    }
    
    // Step 7: Check eligibility and calculate points
    if (verbose) console.log('\nChecking eligibility and calculating points...');
    
    const holderPointsArray: HolderEntry[] = [];
    
    for (const [handle, addressHoldingsArray] of userHoldings.entries()) {
      // Skip if no address holdings
      if (addressHoldingsArray.length === 0) continue;
      
      // If sumOfBalances is false, use only the first address
      const addressesToUse = sumOfBalances ? addressHoldingsArray : [addressHoldingsArray[0]];
      
      const tokenHoldingsMap: {[key:string]:TokenHolding} = {};
      const nftHoldingsMap: {[key:string]:NftHolding} = {};
  
      // Process each address
      for (const addressHoldings of addressesToUse) {
        const address = addressHoldings.address;
        
        // Process token holdings
        for (const tokenConfig of leaderboardTokens) {
          const symbol = tokenConfig.symbol;
          
          // If this token is already in the address holdings, use it
          if (symbol in addressHoldings.tokenHoldings) {
            if(tokenHoldingsMap[symbol]){
              tokenHoldingsMap[symbol].tokenBalance += addressHoldings.tokenHoldings[symbol].tokenBalance;
            }
            else tokenHoldingsMap[symbol] = addressHoldings.tokenHoldings[symbol];
          }else{
            const balance = await fetchTokenBalanceWithEthers(
              tokenConfig.address,
              address,
              tokenConfig.decimals,
              verbose
            );
            
            // Only add if balance is greater than 0
            if (balance > 0) {
              if(tokenHoldingsMap[symbol]){
                tokenHoldingsMap[symbol].tokenBalance += balance.toString();
              }
              else 
                tokenHoldingsMap[symbol] = {
                  tokenBalance: balance.toString(),
                  tokenSymbol: symbol,
                  tokenDecimals: tokenConfig.decimals,
                  tokenAddress: tokenConfig.address
                };
            }
          }
        }
        
        // Process NFT holdings
        for (const nftConfig of leaderboardNfts) {
          const name = nftConfig.name;
          
          // If this NFT is already in the address holdings, use it
          if (name in addressHoldings.nftHoldings) {
            if(nftHoldingsMap[name]){
                nftHoldingsMap[name].tokenBalance += addressHoldings.nftHoldings[name].tokenBalance;
            }else nftHoldingsMap[name] = addressHoldings.nftHoldings[name];
          }
        }
        
      }
      
      // Check eligibility using the leaderboard implementation
      const isEligible = await leaderboard.checkEligibility(
        Object.values(tokenHoldingsMap),
        Object.values(nftHoldingsMap),
        leaderboardTokens,
        leaderboardNfts
      );
      
      if (!isEligible) {
        if (verbose) console.log(`${handle} is not eligible for the leaderboard`);
        continue;
      }
      if (verbose) console.log(`${handle} is eligible for the leaderboard`);
      // Calculate points using the leaderboard implementation
      const holderPoints = await leaderboard.calculatePoints(
        Object.values(tokenHoldingsMap),
        Object.values(nftHoldingsMap),
        leaderboardTokens,
        leaderboardNfts,
        verbose
      );
      
      // Create holder points object
      const holderEntry: HolderEntry = {
        address: addressesToUse[0].address, // Use the first address as the primary
        twitterHandle: handle,
        profileImageUrl: arenaPictureMapping.get(handle) || null, // Will be fetched later
        points: holderPoints,
      };
      
      // Add to holder points array
      holderPointsArray.push(holderEntry);
    }
    
    // Step 8: Filter out excluded accounts
    const excludedAccounts = leaderboardConfig.excludedAccounts || [];
    const filteredHolderPoints = holderPointsArray.filter(holder => {
      if (holder.twitterHandle && excludedAccounts.includes(holder.twitterHandle.toLowerCase())) {
        if (verbose) console.log(`Excluding account from leaderboard: ${holder.twitterHandle}`);
        return false;
      }
      return true;
    });
    
    if (verbose) console.log(`\nCalculated points for ${filteredHolderPoints.length} eligible holders (${holderPointsArray.length - filteredHolderPoints.length} excluded)`);
    
    return filteredHolderPoints;
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
  const batchSize = 5;
  
  // Process entries in batches to avoid rate limiting
  for (let i = 0; i < leaderboard.entries.length; i += batchSize) {
    const batch = leaderboard.entries.slice(i, i + batchSize);
    const batchPromises = [];
    
    for (const entry of batch) {
      // Only process entries that have a Twitter handle but no profile picture
      if (entry.twitterHandle && !entry.profileImageUrl) {
        batchPromises.push((async () => {
          try {
            //if (verbose) console.log(`Fetching profile picture for ${entry.twitterHandle}...`);
            const profilePicture = await fetchTwitterProfilePicture(entry.twitterHandle);
            
            if (profilePicture) {
              entry.profileImageUrl = profilePicture;
              updatedCount++;
              //if (verbose) console.log(`Found profile picture for ${entry.twitterHandle}`);
            } else if (verbose) {
              console.log(`No profile picture found for ${entry.twitterHandle}`);
            }
          } catch (error) {
            console.error(`Error fetching profile picture for ${entry.twitterHandle}:`, error);
          }
        })());
      }
    }
    
    // Wait for all promises in this batch to complete
    await Promise.all(batchPromises);
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < leaderboard.entries.length) {
      await sleep(500);
    }
  }
  
  if (verbose) console.log(`Updated profile pictures for ${updatedCount} entries`);
  
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
    
    // Calculate holder points
    if (verbose) {
      console.log('Calculating holder points using MuLeaderboard implementation...');
    } else {
      console.log('Calculating holder points...');
    }
    
    const holderPoints = await calculateHolderPoints(appConfig, muLeaderboard, verbose);
    
    if (verbose) {
      console.log('Loaded MU leaderboard configuration');
    }
    
    // Generate leaderboard - include all entries (pass 0 for maxEntries)
    if (verbose) {
      console.log('Generating MU leaderboard...');
    } else {
      console.log('Generating leaderboard...');
    }
    
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
    
    // Save leaderboard to HTML file
    const htmlOutputPath = jsonOutputPath.replace('.json', '.html');
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
