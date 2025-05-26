import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';

import { TokenHolding, NftHolding } from '../../types/interfaces';
import { HolderEntry, Leaderboard } from '../../types/leaderboard';
import { BaseLeaderboard } from '../../types/leaderboard';
import { saveLeaderboardHtml } from '../../utils/htmlGenerator';

// Import from API modules
import { fetchNftHoldersFromEthers } from '../../api/blockchain';

// Import shared utility functions
import {
  saveLeaderboard,
  processWalletHoldings
} from '../utils/leaderboardUtils';
import { fetchTokenHolders } from '../../utils/helpers';
import { fetchTwitterProfilePicture } from '../../api/arenabook';
import { sleep } from '../../utils/helpers';
import { ProjectConfig } from '../../utils/config';
import { AppConfig } from '../../utils/config';
import { getArenaAddressForHandle, loadWalletMapping } from '../../utils/walletMapping';
import { fetchArenabookSocial } from '../../api/arenabook';
import { createLeaderboard } from './leaderboardFactory';
import logger from '../../utils/logger';
// Setup ethers provider for Avalanche
let provider: ethers.JsonRpcProvider;
export function setupLeaderboardProvider(apiKey: string) {

  if (!apiKey) {
    logger.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching NFT holders.');
    return;
  }

  // Avalanche RPC URL using Alchemy API key
  const AVALANCHE_RPC_URL = `https://avax-mainnet.g.alchemy.com/v2/${apiKey}`;

  provider = new ethers.JsonRpcProvider(AVALANCHE_RPC_URL);
}
/**
 * Calculate points for each holder based on their token and NFT holdings
 * using the specified leaderboard implementation
 * @param leaderboard The leaderboard implementation to use
 * @param projectConfig The project configuration
 * @returns Array of holder points
 */
export async function calculateHolderPoints(leaderboard: BaseLeaderboard, projectConfig: ProjectConfig): Promise<HolderEntry[]> {
  try {
    
    const leaderboardTokens = leaderboard.getLeaderboardTokens();
    const leaderboardNfts = leaderboard.getLeaderboardNFTs();
    const sumOfBalances = leaderboard.getSumOfBalances();

    logger.verboseLog(`Sum of balances feature is ${sumOfBalances ? 'enabled' : 'disabled'} for leaderboard`);
    
    // Step 1: Create mappings to store token and NFT holdings for each wallet
    const walletToTokenHoldings = new Map<string, Map<string, TokenHolding>>();
    const walletToNftHoldings = new Map<string, Map<string, NftHolding>>();
    
    // Step 2: Fetch NFT holders
    logger.verboseLog('\nFetching NFT holders...');
    const qualifyedNftHolders = new Set<string>();
    for (const nftConfig of leaderboardNfts) {
      let minNftBalance = await leaderboard.calculateDynamicMinimumBalance(nftConfig.name);
      if (sumOfBalances) {
        minNftBalance = Math.ceil(minNftBalance * 0.5);
      }
      logger.verboseLog(`Fetching ${nftConfig.name} NFT holders (min balance: ${minNftBalance})...`);
      
      const nftHolders = await fetchNftHoldersFromEthers(
        nftConfig.address,
        nftConfig.name,
        1,
        nftConfig.collectionSize
      );
      logger.verboseLog(`Found ${nftHolders.length} ${nftConfig.name} NFT holders`);
      
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
    logger.verboseLog('\nFetching token holders...');
    
    for (const tokenConfig of leaderboardTokens) {
      let minTokenBalance = await leaderboard.calculateDynamicMinimumBalance(tokenConfig.symbol);
      if (sumOfBalances) {
        minTokenBalance = minTokenBalance * 0.5;
      }
      logger.verboseLog(`Fetching ${tokenConfig.symbol} token holders (min balance: ${minTokenBalance})...`);
      
      const tokenHolders = await fetchTokenHolders(
        tokenConfig.address,
        tokenConfig.symbol,
        minTokenBalance,
        tokenConfig.decimals
      );
      
      logger.verboseLog(`Found ${tokenHolders.length} ${tokenConfig.symbol} token holders`);
      
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
        logger.verboseLog(`Adding token holding for ${tokenConfig.symbol} for wallet ${address}: ${holder.holding.tokenBalance}`);
        // Add to wallet's token holdings
        walletToTokenHoldings.get(address)!.set(tokenConfig.symbol, tokenHolding);
        
      }
    }
    
    // Step 4: Create a map of twitter_handle to wallet and origin
    const userWallets = new Map<string, Record<string, string>>();
    
    // Step 5: Check which wallets are in the wallet mapping file
    logger.verboseLog('\nProcessing wallet mappings...');

    // Get all addresses from token and NFT holdings
    const allAddresses = new Set<string>([...walletToTokenHoldings.keys(), ...qualifyedNftHolders]);

    logger.verboseLog(`Found ${allAddresses.size} unique addresses`);
    
    // Load wallet mapping if available
    const walletMappingFile = projectConfig.walletMappingFile;
    if (walletMappingFile) {
      logger.verboseLog(`Loading wallet mapping from ${walletMappingFile}...`);
      
      const walletMapping = loadWalletMapping(walletMappingFile);
      
      logger.verboseLog(`Loaded ${Object.keys(walletMapping).length} wallet mappings`);
      
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
    } else 
      logger.verboseLog('No wallet mapping file specified');
    
    
    // Step 6: For remaining wallets, fetch Arena profiles
    logger.verboseLog('\nFetching Arena profiles for remaining wallets...');
    
    const arenaPictureMapping = new Map<string, string>();
    if(sumOfBalances){
      for (const handle of userWallets.keys()){
        logger.verboseLog(`Fetching Arena profile for handle ${handle}...`);
        const social = await getArenaAddressForHandle(handle);
        
        if (social) {
          arenaPictureMapping.set(social.address.toLowerCase(), social.picture_url);
          allAddresses.delete(social.address.toLowerCase());
          if (!(userWallets.get(handle)![social.address.toLowerCase()])){
            logger.verboseLog(`Adding Arena address for handle ${handle}: ${social.address}`);
            userWallets.get(handle)![social.address.toLowerCase()] = "arena";
          }
        }
        else 
          logger.verboseLog(`No Arena address found for handle ${handle}`);
        
        await sleep(200);
      }
    }


    // Process addresses that haven't been processed yet
    const addressesToProcess = Array.from(allAddresses);
    logger.verboseLog(`Fetching Arena profiles for ${addressesToProcess.length} addresses...`);
    
    // Process addresses in batches to improve performance and avoid rate limiting
    const BATCH_SIZE = 10;
    const REQUEST_DELAY_MS = 500; // 500ms delay between requests

    for (let i = 0; i < addressesToProcess.length; i += BATCH_SIZE) {
      const batch = addressesToProcess.slice(i, i + BATCH_SIZE);
      
      logger.verboseLog(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(addressesToProcess.length / BATCH_SIZE)}...`);
      
      // Process wallets in parallel with rate limiting
      const promises = batch.map(async (address) => {
        try {
          // Fetch Arena profile for this wallet
          const social = await fetchArenabookSocial(address);

          // Skip wallets without a Twitter handle
          if (!social || !social.twitter_handle) {
            logger.verboseLog(`No Twitter handle found for wallet ${address}, skipping...`);
            return;
          }
          
          const lowerHandle = social.twitter_handle.toLowerCase();
          if(social.twitter_pfp_url)
            arenaPictureMapping.set(lowerHandle, social.twitter_pfp_url);

          // Initialize user holdings array if it doesn't exist
          if (!userWallets.has(lowerHandle) ) {
            userWallets.set(lowerHandle, {});
          }

          // Add to user holdings
          userWallets.get(lowerHandle)![address] = "arena";
        } catch (error) {
          if (error instanceof Error) logger.error(`Error processing wallet ${address}:`, error.message);
          else logger.verboseLog(`Error processing wallet ${address}: ${error}`, `Error processing wallet ${address}`);
        }

      });
      
      // Add delay between requests to avoid rate limiting
      await sleep(REQUEST_DELAY_MS);
      // Wait for all promises in this batch to complete before moving to the next batch
      await Promise.all(promises);
    }
    
    // Step 7: Check eligibility and calculate points
    logger.verboseLog('\nChecking eligibility and calculating points...');
    
    const holderPointsArray: HolderEntry[] = [];
    
    // Convert Map entries to array for batching
    const userWalletsArray = Array.from(userWallets.entries());
    
    // Process in batches of 10 users at a time
    const totalBatches = Math.ceil(userWalletsArray.length / BATCH_SIZE);
    
    logger.verboseLog(`Processing ${userWalletsArray.length} users in ${totalBatches} batches of ${BATCH_SIZE}`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, userWalletsArray.length);
      const currentBatch = userWalletsArray.slice(startIdx, endIdx);
      
      logger.verboseLog(`Processing batch ${batchIndex + 1}/${totalBatches} with ${currentBatch.length} users`);
      
      // Process each user in the batch in parallel
      const batchPromises = currentBatch.map(async ([handle, addressRecord]) => {
        // Use the extracted function to process wallet holdings and check eligibility
        return processWalletHoldings(
          handle,
          addressRecord,
          walletToTokenHoldings,
          walletToNftHoldings,
          leaderboard,
          sumOfBalances
        );
      });

      await sleep(REQUEST_DELAY_MS);
      
      const batchResults = await Promise.all(batchPromises);
      // Add valid results to the holder points array
      for (const result of batchResults) {
        if (result) {
          holderPointsArray.push(result);
        }
      }

      logger.verboseLog(`Completed batch ${batchIndex + 1}/${totalBatches}, processed ${batchPromises.filter(r => r !== null).length} eligible users`);
    }
    
    for (const entry of holderPointsArray) {
      if (entry.twitterHandle && !entry.profileImageUrl) {
        entry.profileImageUrl = arenaPictureMapping.get(entry.twitterHandle) || null;
      }
    }
    
    // Step 8: Filter out excluded accounts
    const filteredHolderPoints = leaderboard.filterExcludedAccounts(holderPointsArray);
    
    logger.verboseLog(`\nCalculated points for ${filteredHolderPoints.length} eligible holders (${holderPointsArray.length - filteredHolderPoints.length} excluded)`);
    
    return filteredHolderPoints;
  } catch (error) {
    logger.error('Error calculating holder points:', error);
    throw error;
  }
}

/**
 * Fetch Twitter profile pictures for leaderboard entries that don't have one
 * @param leaderboard The leaderboard to update
 * @returns The updated leaderboard
 */
async function fetchProfilePicturesForLeaderboard(leaderboard: Leaderboard): Promise<Leaderboard> {
  logger.verboseLog('\nFetching Twitter profile pictures for leaderboard entries...');

  const batchSize = 5;
  
  // Process entries in batches to avoid rate limiting
  for (let i = 0; i < leaderboard.entries.length; i += batchSize) {
    const batch = leaderboard.entries.slice(i, i + batchSize);
    const batchPromises = [];
    let updatedThisBatch = 0;
    for (const entry of batch) {
      // Only process entries that have a Twitter handle but no profile picture
      if (entry.twitterHandle && !entry.profileImageUrl) {
        batchPromises.push((async () => {
          try {
            const profilePicture = await fetchTwitterProfilePicture(entry.twitterHandle);
            
            if (profilePicture) {
              entry.profileImageUrl = profilePicture;
              updatedThisBatch++;
              logger.verboseLog(`Found profile picture for ${entry.twitterHandle}`);
            } else {
              logger.verboseLog(`No profile picture found for ${entry.twitterHandle}`);
            }
          } catch (error) {
            logger.error(`Error fetching profile picture for ${entry.twitterHandle}:`, error);
          }
        })());
      }
    }
    
    // Wait for all promises in this batch to complete
    await Promise.all(batchPromises);
    
    logger.verboseLog(`Updated profile pictures for ${updatedThisBatch} entries in batch ${i / batchSize + 1}`);

    // Add a small delay between batches to avoid rate limiting
    if (updatedThisBatch > 0) {
      await sleep(500);
    }
  }
  
  
  return leaderboard;
}

/**
 * Generate and save leaderboard
 */
export async function generateAndSaveLeaderboard(appConfig: AppConfig): Promise<Leaderboard> {
  try {
    logger.verboseLog(`Starting leaderboard generation for ${appConfig.projectName}...`);
    
    const leaderboardConfig = appConfig.leaderboardConfig;
    if (!leaderboardConfig) {
      throw new Error('Leaderboard configuration not found');
    }
    
    // Create StandardLeaderboard instance
    const leaderboardType = createLeaderboard(provider, leaderboardConfig, appConfig.projectName);
    
    // Calculate holder points
    logger.verboseLog(`Calculating holder points using ${leaderboardType.constructor.name} implementation...`,'Calculating holder points...');
    
    const holderPoints = await calculateHolderPoints(leaderboardType, appConfig.projectConfig);
        
    logger.verboseLog(`Generating leaderboard using ${leaderboardType.constructor.name} implementation...`,'Generating leaderboard...');
    
    const leaderboard = leaderboardType.generateLeaderboard(holderPoints);
    
    logger.verboseLog(`Generated leaderboard with ${leaderboard.entries.length} entries`);
    
    // Fetch Twitter profile pictures for entries that don't have one
    await fetchProfilePicturesForLeaderboard(leaderboard);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'output', 'leaderboards');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      logger.verboseLog(`Created output directory: ${outputDir}`);
    }    
    
    // Save leaderboard to JSON file
    const jsonOutputPath = path.join(outputDir, leaderboardType.getOutputFileName());
    saveLeaderboard(leaderboard, jsonOutputPath);
    
    logger.verboseLog(`Saved leaderboard JSON to ${jsonOutputPath}`);
    
    // Save leaderboard to HTML file
    let htmlOutputPath = jsonOutputPath.replace('.json', '.html');
    if (leaderboardConfig.output && leaderboardConfig.output.fileName) {
      htmlOutputPath = path.join(outputDir, leaderboardConfig.output.fileName);
    }
    saveLeaderboardHtml(leaderboard, htmlOutputPath, leaderboardConfig.output);
    
    logger.verboseLog(`Saved leaderboard HTML to ${htmlOutputPath}`);
    
    // Copy logo file to assets directory if specified in config
    if (leaderboardConfig.output && leaderboardConfig.output.logoPath) {
      const assetsDir = path.join(outputDir, 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
        logger.verboseLog(`Created assets directory: ${assetsDir}`);
      }
      
      // Copy logo file
      const logoSource = path.join(process.cwd(), 'assets', leaderboardConfig.output.logoPath);
      const logoTarget = path.join(assetsDir, leaderboardConfig.output.logoPath);
      fs.copyFileSync(logoSource, logoTarget);
      
      logger.verboseLog(`Copied logo from ${logoSource} to ${logoTarget}`);
    }
    
    // Print total number of entries
    logger.log(`Standard leaderboard generated and saved to ${outputDir}`);
    logger.log(`Total entries: ${leaderboard.entries.length}`);
    
    return leaderboard;
  } catch (error) {
    logger.error('Error generating standard leaderboard:', error);
    throw error;
  }
}
