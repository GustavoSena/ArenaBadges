import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

import { TokenHolding, NftHolding } from '../../types/interfaces';
import { HolderEntry, Leaderboard } from '../../types/leaderboard';
import { BaseLeaderboard } from '../../types/leaderboard';
import { saveLeaderboardHtml } from '../../utils/htmlGenerator';

// Import from API modules
import {
  fetchNftHoldersFromEthers
} from '../../api/blockchain';

// Import shared utility functions
import {
  saveLeaderboard  
} from '../utils/leaderboardUtils';
import { fetchTokenBalance, fetchTokenHolders } from '../../utils/helpers';
import { fetchTwitterProfilePicture } from '../../api/arenabook';
import { sleep } from '../../utils/helpers';
import { AppConfig } from '../../utils/config';
import { getArenaAddressForHandle, loadWalletMapping } from '../../utils/walletMapping';
import { fetchArenabookSocial } from '../../api/arenabook';
import { createLeaderboard } from './leaderboardFactory';

// Setup ethers provider for Avalanche
let provider: ethers.JsonRpcProvider;
export function setupLeaderboardProvider(apiKey: string) {

  if (!apiKey) {
    console.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching NFT holders.');
    return;
  }

  // Avalanche RPC URL using Alchemy API key
  const AVALANCHE_RPC_URL = `https://avax-mainnet.g.alchemy.com/v2/${apiKey}`;

  provider = new ethers.JsonRpcProvider(AVALANCHE_RPC_URL);
}
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
    const qualifyedNftHolders = new Set<string>();
    for (const nftConfig of leaderboardNfts) {
      let minNftBalance = await leaderboard.calculateDynamicMinimumBalance(nftConfig.name);
      if (sumOfBalances) {
        minNftBalance = Math.ceil(minNftBalance * 0.5);
      }
      if (verbose) console.log(`Fetching ${nftConfig.name} NFT holders (min balance: ${minNftBalance})...`);
      
      const nftHolders = await fetchNftHoldersFromEthers(
        nftConfig.address,
        nftConfig.name,
        1,
        verbose,
        nftConfig.collectionSize
      );
      if (verbose) console.log(`Found ${nftHolders.length} ${nftConfig.name} NFT holders`);
      
      // Add NFT holdings to the mapping
      for (const holder of nftHolders) {
        const address = holder.address.toLowerCase();
        if (holder.tokenCount >= minNftBalance) {
          qualifyedNftHolders.add(address);
        }
        
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
        minTokenBalance,
        tokenConfig.decimals,
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
          tokenBalance: holder.holding.tokenBalance,
          tokenDecimals: tokenConfig.decimals,
          balanceFormatted: holder.holding.balanceFormatted
        };
        if (verbose) console.log(`Adding token holding for ${tokenConfig.symbol} for wallet ${address}: ${holder.holding.tokenBalance}`);
        // Add to wallet's token holdings
        walletToTokenHoldings.get(address)!.set(tokenConfig.symbol, tokenHolding);
        
      }
    }
    
    // Step 4: Create a map of twitter_handle to wallet and origin
    const userWallets = new Map<string, Record<string, string>>();
    
    // Step 5: Check which wallets are in the wallet mapping file
    if (verbose) console.log('\nProcessing wallet mappings...');

    // Get all addresses from token and NFT holdings
    const allAddresses = new Set<string>([...walletToTokenHoldings.keys(), ...qualifyedNftHolders]);

    if (verbose) console.log(`Found ${allAddresses.size} unique addresses`);
    
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
        if (!userWallets.has(lowerHandle)) {
          userWallets.set(lowerHandle, {});
        }
        
        // Add to user holdings
        userWallets.get(lowerHandle)![lowerAddress] = "mapping";
      }
    } else {
      if (verbose) console.log('No wallet mapping file specified');
    }
    
    // Step 6: For remaining wallets, fetch Arena profiles
    if (verbose) console.log('\nFetching Arena profiles for remaining wallets...');
    
    const arenaPictureMapping = new Map<string, string>();
    if(sumOfBalances){
      for (const handle of userWallets.keys()){
        if (verbose) console.log(`Fetching Arena profile for handle ${handle}...`);
        await sleep(500);
        const social = await getArenaAddressForHandle(handle);
        
        if (!social) {
          console.log(`No Arena address found for handle ${handle}`);
        }
        else {
          arenaPictureMapping.set(social.address.toLowerCase(), social.picture_url);
          allAddresses.delete(social.address.toLowerCase());
          if (!(userWallets.get(handle)![social.address.toLowerCase()])){
            if(verbose) console.log(`Adding Arena address for handle ${handle}: ${social.address}`);
            userWallets.get(handle)![social.address.toLowerCase()] = "arena";
          }
        }
      }
    }


    // Process addresses that haven't been processed yet
    const addressesToProcess = Array.from(allAddresses);
    if (verbose) console.log(`Fetching Arena profiles for ${addressesToProcess.length} addresses...`);
    
    // Process addresses in batches to improve performance and avoid rate limiting
    const BATCH_SIZE = 10;
    const REQUEST_DELAY_MS = 500; // 500ms delay between requests
    

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

          if (!userWallets.has(lowerHandle) ) {
            userWallets.set(lowerHandle, {});
          } else if (!sumOfBalances && userWallets.get(lowerHandle)!){
            if (verbose) console.log(`sumOfBalances is disabled and we already have this Twitter handle ${lowerHandle}, skipping...`);
            return;
          } 

          // Add to user holdings
          userWallets.get(lowerHandle)![address] = "arena";
        } catch (error) {
          if (error instanceof Error) console.error(`Error processing wallet ${address}:`, error.message);
          else if(verbose) console.error(`Error processing wallet ${address}:`, error);
          else console.error(`Error processing wallet ${address}`);
        }

      });
      
      // Add delay between requests to avoid rate limiting
      await sleep(REQUEST_DELAY_MS);
      // Wait for all promises in this batch to complete before moving to the next batch
      await Promise.all(promises);
    }
    
    // Step 7: Check eligibility and calculate points
    console.log('\nChecking eligibility and calculating points...');
    
    const holderPointsArray: HolderEntry[] = [];
    
    // Convert Map entries to array for batching
    const userWalletsArray = Array.from(userWallets.entries());
    
    // Process in batches of 10 users at a time
    const totalBatches = Math.ceil(userWalletsArray.length / BATCH_SIZE);
    
    if (verbose) console.log(`Processing ${userWalletsArray.length} users in ${totalBatches} batches of ${BATCH_SIZE}`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, userWalletsArray.length);
      const currentBatch = userWalletsArray.slice(startIdx, endIdx);
      
      if (verbose) console.log(`Processing batch ${batchIndex + 1}/${totalBatches} with ${currentBatch.length} users`);
      
      // Process each user in the batch in parallel
      const batchPromises = currentBatch.map(async ([handle, addressRecord]) => {
        const addresses = Object.keys(addressRecord);
        // Skip if no address holdings
        if (addresses.length === 0) return null;
        
        // If sumOfBalances is false, use only the first address
        const addressesToUse = sumOfBalances ? addresses : [addresses[0]];
        
        const tokenHoldingsMap: {[key:string]:TokenHolding} = {};
        const nftHoldingsMap: {[key:string]:NftHolding} = {};
    
        // Process each address
        for (const address of addressesToUse) {
          if (verbose) console.log(`Processing address ${address} for Twitter handle ${handle}`);
          
          // Process token holdings in parallel for each address
          const tokenPromises = leaderboardTokens.map(async (tokenConfig) => {
            const symbol = tokenConfig.symbol;
            
            if (walletToTokenHoldings.has(address) && walletToTokenHoldings.get(address)!.has(symbol)) {
              return { symbol, holding: walletToTokenHoldings.get(address)!.get(symbol)! };
            } else {
              if (verbose) console.log(`Fetching token balance for ${symbol} for address ${address}...`);
              const balance = await fetchTokenBalance(
                tokenConfig.address,
                address,
                tokenConfig.decimals,
                verbose
              );
              
              // Only return if balance is greater than 0
              if (balance > 0) {
                if (verbose) console.log(`Adding token holding for ${symbol} for wallet ${address}: ${balance}`);
                return { 
                  symbol, 
                  holding: {
                    tokenAddress: tokenConfig.address, 
                    tokenSymbol: tokenConfig.symbol, 
                    tokenBalance: balance.toString(), 
                    tokenDecimals: tokenConfig.decimals, 
                    balanceFormatted: balance
                  }
                };
              }
              return null;
            }
          });
          
          // Wait for all token balance checks to complete
          const tokenResults = await Promise.all(tokenPromises);
          
          // Add the results to the token holdings map
          for (const result of tokenResults) {
            if (result) {
              const { symbol, holding } = result;
              if (tokenHoldingsMap[symbol]) {
                tokenHoldingsMap[symbol].balanceFormatted = tokenHoldingsMap[symbol].balanceFormatted! + holding.balanceFormatted!;
              } else {
                tokenHoldingsMap[symbol] = holding;
              }
            }
          }
          
          // Process NFT holdings
          if (walletToNftHoldings.has(address)) {
            const nftHoldings = walletToNftHoldings.get(address)!;
            for (const [name, holding] of nftHoldings.entries()) {
              if (nftHoldingsMap[name]) {
                nftHoldingsMap[name].tokenBalance = (+nftHoldingsMap[name].tokenBalance! + +holding.tokenBalance!).toString();
              } else {
                nftHoldingsMap[name] = holding;
              }
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
          return null;
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
        
        // Create and return holder points object
        return {
          address: addressesToUse[0], // Use the first address as the primary
          twitterHandle: handle,
          profileImageUrl: arenaPictureMapping.get(handle) || null,
          points: holderPoints,
        };
      });

      await sleep(REQUEST_DELAY_MS);
      
      const batchResults = await Promise.all(batchPromises);
      // Add valid results to the holder points array
      for (const result of batchResults) {
        if (result) {
          holderPointsArray.push(result);
        }
      }


      if (verbose) console.log(`Completed batch ${batchIndex + 1}/${totalBatches}, processed ${batchPromises.filter(r => r !== null).length} eligible users`);
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
 * Generate and save standard leaderboard
 * @param verbose Whether to log verbose output
 */
export async function generateAndSaveLeaderboard(appConfig: AppConfig, verbose: boolean = false): Promise<Leaderboard> {
  try {
    if (verbose) {
      console.log('Starting standard leaderboard generation...');
    }
    
    const leaderboardConfig = appConfig.leaderboardConfig;
    if (!leaderboardConfig) {
      throw new Error('Leaderboard configuration not found');
    }
    
    // Create StandardLeaderboard instance
    const leaderboardType = createLeaderboard(provider, leaderboardConfig.excludedAccounts, appConfig.projectName);
    
    // Calculate holder points
    if (verbose) {
      console.log('Calculating holder points using StandardLeaderboard implementation...');
    } else {
      console.log('Calculating holder points...');
    }
    
    const holderPoints = await calculateHolderPoints(appConfig, leaderboardType, verbose);
    
    if (verbose) {
      console.log('Loaded standard leaderboard configuration');
    }
    
    // Generate leaderboard - include all entries (pass 0 for maxEntries)
    if (verbose) {
      console.log('Generating standard leaderboard...');
    } else {
      console.log('Generating leaderboard...');
    }
    
    const leaderboard = leaderboardType.generateLeaderboard(holderPoints, 0);
    
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
    const jsonOutputPath = path.join(outputDir, leaderboardType.getOutputFileName());
    saveLeaderboard(leaderboard, jsonOutputPath);
    
    if (verbose) {
      console.log(`Saved standard leaderboard JSON to ${jsonOutputPath}`);
    }
    
    // Save leaderboard to HTML file
    let htmlOutputPath = jsonOutputPath.replace('.json', '.html');
    if (leaderboardConfig.output && leaderboardConfig.output.fileName) {
      htmlOutputPath = path.join(outputDir, leaderboardConfig.output.fileName);
    }
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
