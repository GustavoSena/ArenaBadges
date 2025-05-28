// Token Holder Profiles Fetcher
import { TokenConfig, NftConfig, TokenHolding, NftHolding } from '../../types/interfaces';
import { loadWalletMapping, getHandleToWalletMapping, getArenaAddressForHandle } from '../../utils/walletMapping';
import { fetchArenabookSocial } from '../../api/arenabook';
import { fetchNftHoldersFromEthers } from '../../api/blockchain';
import { sleep, fetchTokenHolders } from '../../utils/helpers';
import { updateTokenHoldingsMap, processTokenBalances } from '../../utils/tokenUtils';
import { AppConfig } from '../../utils/config';
import logger from '../../utils/logger';
import { BATCH_SIZE, REQUEST_DELAY_MS } from '../../types/constants';
// Export the HolderResults interface for use in other files
export interface HolderResults {
  basicHolders: string[];
  upgradedHolders?: string[];
  basicAddresses: string[];
  upgradedAddresses?: string[];
  timestamp: string;
}

/**
 * Main function to fetch badge holder profiles
 */
export async function fetchBadgeHolders(appConfig: AppConfig): Promise<HolderResults> {
  logger.log(`Fetching badge holder profiles for project: ${appConfig.projectName}`);
  
  try {
    // Get badge configurations with the project-specific config
    const basicRequirements = appConfig.badgeConfig.badges.basic;
    const upgradedRequirements = appConfig.badgeConfig.badges.upgraded || null;

    basicRequirements?.tokens?.map(token => {
      token.address = token.address.toLowerCase();
    });
    
    upgradedRequirements?.tokens?.map(token => {
      token.address = token.address.toLowerCase();
    });
    
    // Check if sum of balances feature is enabled
    const sumOfBalances = appConfig.badgeConfig.sumOfBalances || false;
    logger.log(`Sum of balances feature is ${sumOfBalances ? 'enabled' : 'disabled'}`);
    
    // Get permanent accounts from project configuration
    const permanentAccounts = appConfig.badgeConfig.permanentAccounts || [];
    logger.log(`Loaded ${permanentAccounts.length} permanent accounts: ${permanentAccounts.join(', ')}`);
    
    // Check if basic badges should be excluded for upgraded badge holders
    const excludeBasicForUpgraded = appConfig.badgeConfig.excludeBasicForUpgraded || false;
    logger.log(`Exclude basic badges for upgraded badge holders: ${excludeBasicForUpgraded ? 'yes' : 'no'}`);
    
    // Step 1: Collect all unique tokens and NFTs from both badge tiers
    const allTokens = new Array<TokenConfig>();
    const allNfts = new Array<NftConfig>();
    
    // Step 2: Create a map of token address to minimum balance required
    // If a token appears in both basic and upgraded, use the lower balance
    const tokenMinBalances = new Map<string, { minBalance: number, token: TokenConfig }>();
    const nftMinBalances = new Map<string, { minBalance: number, nft: NftConfig }>();
    
    // Process tokens from basic requirements
    if (basicRequirements.tokens) {
      allTokens.push(...basicRequirements.tokens);
      for (const token of basicRequirements.tokens) {
        tokenMinBalances.set(token.address, { minBalance: token.minBalance, token });
      }
    }

    if (basicRequirements.nfts) {
      allNfts.push(...basicRequirements.nfts);
      for (const nft of basicRequirements.nfts) {
        nftMinBalances.set(nft.address, { minBalance: nft.minBalance, nft });
      }
    }
    // Process tokens from upgraded requirements (if they exist)
    if (upgradedRequirements?.tokens) {
      for (const token of upgradedRequirements.tokens) {
        if (!allTokens.find(t => t.address === token.address)) {
          allTokens.push(token)
        }
        
        // If token already exists in the map, use the lower of the two balances
        if (!tokenMinBalances.has(token.address) || token.minBalance < tokenMinBalances.get(token.address)!.minBalance) 
          tokenMinBalances.set(token.address, { minBalance: token.minBalance, token });
      }
    }
    if (upgradedRequirements?.nfts) {
      for (const nft of upgradedRequirements.nfts) {
        if (!allNfts.find(t => t.address === nft.address))
          allNfts.push(nft)
        
        // If token already exists in the map, use the lower of the two balances
        if (!nftMinBalances.has(nft.address) || nft.minBalance < nftMinBalances.get(nft.address)!.minBalance) 
          nftMinBalances.set(nft.address, { minBalance: nft.minBalance, nft });
      }
    }
    logger.log(`Found ${allTokens.length} unique tokens and ${allNfts.length} unique NFTs across all badge tiers`);

    // Step 3: Create mappings to store token and NFT holdings by wallet address
    const walletToTokenHoldings = new Map<string, Map<string, TokenHolding>>();
    const walletToNftHoldings = new Map<string, Map<string, NftHolding>>();
    
    // Step 4: Fetch all addresses that have the minimum balance for each token
    logger.log('Fetching token holders...');
    for (const [tokenAddress, { minBalance, token }] of tokenMinBalances.entries()) {
      let minBal = sumOfBalances ? minBalance / 2 : minBalance;
      logger.verboseLog(`Fetching holders for ${token.symbol} (${tokenAddress}) with min balance ${minBal}...`);

      // Fetch token holders with the minimum balance
      const tokenHolders = await fetchTokenHolders(
        tokenAddress,
        token.symbol,
        minBal,
        token.decimals
      );
      
      logger.log(`Found ${tokenHolders.length} holders for ${token.symbol} with balance >= ${minBal}`);
      
      // Store token holdings for each wallet
      for (const holder of tokenHolders) {
        // Initialize token holdings map for this wallet if it doesn't exist
        if (!walletToTokenHoldings.has(holder.address))
          walletToTokenHoldings.set(holder.address, new Map<string, TokenHolding>());
        
        walletToTokenHoldings.get(holder.address)!.set(tokenAddress, holder.holding);
      }
    }
    const nftValidAddresses = new Set<string>();
    // Step 5: Fetch all NFT holders for each NFT
    logger.log('Fetching NFT holders...');
    for (const nft of allNfts) {
      let minNftBalance = sumOfBalances ? nftMinBalances.get(nft.address)!.minBalance / 2 : nftMinBalances.get(nft.address)!.minBalance;
      const collectionSize = nft.collectionSize || 20000; // Default to 1000 if not specified
      
      logger.log(`Fetching holders for ${nft.name} (${nft.address}) with min balance ${minNftBalance}...`);
      
      // Fetch NFT holders
      const nftHolders = await fetchNftHoldersFromEthers(
        nft.address,
        nft.name,
        1,
        collectionSize
      );
      
      logger.log(`Found ${nftHolders.length} holders for ${nft.name} with balance >= ${minNftBalance}`);
      
      // Store NFT holdings for each wallet
      for (const holder of nftHolders) {
        // Initialize NFT holdings map for this wallet if it doesn't exist
        if (!walletToNftHoldings.has(holder.address))
          walletToNftHoldings.set(holder.address, new Map<string, NftHolding>());
        
        if (+holder.holding.tokenBalance >= minNftBalance)
          nftValidAddresses.add(holder.address);
        
        // Add NFT holding to the wallet's map
        walletToNftHoldings.get(holder.address)!.set(nft.address, holder.holding);
      }
    }
    
    // Step 6: Create a map of Twitter handle to address holdings
    let userWallets = new Map<string, Set<string>>();
    // Get wallet mapping file path from config (if it exists)
    const walletMappingFile = appConfig.projectConfig.walletMappingFile;

    if (walletMappingFile) {
      logger.log(`Loading wallet mapping from ${walletMappingFile}...`);
      // Initialize wallet mapping variables
      let walletMapping: Record<string, string> = {};
      walletMapping = loadWalletMapping(walletMappingFile, appConfig.projectName);
      userWallets = getHandleToWalletMapping(walletMapping);
      logger.log(`Loaded ${Object.keys(walletMapping).length} wallet-to-handle mappings`);
    } else logger.log(`No wallet mapping file specified. Skipping wallet mapping.`);
    

    if(sumOfBalances){
      for (const handle of userWallets.keys()){
        logger.verboseLog(`Fetching Arena profile for handle ${handle}...`);
        
        const social = await getArenaAddressForHandle(handle);
        
        if (social && social.address) {
          const normalizedAddress = social.address.toLowerCase();
          if (!userWallets.get(handle)!.has(normalizedAddress)) {
            logger.verboseLog(`Adding Arena address for handle ${handle}: ${social.address}`);
            userWallets.get(handle)!.add(normalizedAddress);
          } else 
            logger.warn(`Address ${normalizedAddress} already exists for handle ${handle}`);
        } else 
          logger.warn(`No new Arena address found for handle ${handle}`);
        await sleep(200);
      }
    }
    // Step 8: Process remaining wallets (not in mapping) by fetching Arena profiles
    logger.log('Processing remaining wallets by fetching Arena profiles...');
        
    // Filter out wallets that are already in the mapping
    const allAddresses = new Set<string>([...walletToTokenHoldings.keys(), ... nftValidAddresses]);
    userWallets.forEach((value, key) => {
      allAddresses.delete(key);
    });
    const addressessToProcess = Array.from(allAddresses).map(address => address.toLowerCase());
    
    logger.log(`Found ${addressessToProcess.length} unmapped wallets with token or NFT holdings`);
    
    let promises: Promise<void>[] = [];
    // Process unmapped wallets in batches to avoid rate limiting
    for (let i = 0; i < addressessToProcess.length; i += BATCH_SIZE) {
      const batch = addressessToProcess.slice(i, i + BATCH_SIZE);
      
      logger.verboseLog(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(addressessToProcess.length / BATCH_SIZE)}...`);
      
      // Process wallets in parallel with rate limiting
      promises.push(...batch.map(async (walletAddress) => {
        try {
          // Fetch Arena profile for this wallet
          const profile = await fetchArenabookSocial(walletAddress);
          
          // Skip wallets without a Twitter handle
          if (!profile || !profile.twitter_handle) {
            logger.verboseLog(`No Twitter handle found for wallet ${walletAddress}, skipping...`);
            return;
          }
          
          const twitterHandle = profile.twitter_handle.toLowerCase();

          if (!userWallets.has(twitterHandle))
            userWallets.set(twitterHandle, new Set<string>());
          
          userWallets.get(twitterHandle)!.add(walletAddress);
          
        } catch (error) {
          logger.error(`Error processing wallet ${walletAddress}:`, error);
          throw error;
        }
        
      }));

      await sleep(REQUEST_DELAY_MS);
    }
    
    await Promise.all(promises);
    // Step 9: Check eligibility for basic and upgraded badges
    logger.log('Checking eligibility for badges...');
    
    // Initialize sets to store eligible Twitter handles
    const basicEligibleHandles = new Set<string>();
    const upgradedEligibleHandles = new Set<string>();
    
    // Check eligibility for each Twitter handle
    for (const [twitterHandle, addressRecord] of userWallets.entries()) {
      // Skip checking if this is a permanent account (they'll be added later)
      if (permanentAccounts.includes(twitterHandle))
        continue;
      
      const addressesToUse = Array.from(addressRecord);
      // Skip if no address holdings
      if (addressesToUse.length === 0) continue;
      
     logger.verboseLog(`Processing ${addressesToUse.length} addresses for Twitter handle ${twitterHandle}`);
      let tokenHoldingsMap: {[key:string]:TokenHolding} = {};
      const nftHoldingsMap: {[key:string]:NftHolding} = {};
  
      // Process each address
      for (const address of addressesToUse) {
        logger.verboseLog(`Processing address ${address} for Twitter handle ${twitterHandle}`);
        
        // Process token holdings
        const missingTokens: TokenConfig[] = [];
        
        for (const tokenConfig of allTokens) {
          const tokenAddress = tokenConfig.address.toLowerCase();
          
          if (walletToTokenHoldings.has(address) && walletToTokenHoldings.get(address)!.has(tokenAddress)) {
            const holding = walletToTokenHoldings.get(address)!.get(tokenAddress)!;
            tokenHoldingsMap = updateTokenHoldingsMap(tokenHoldingsMap, tokenAddress, holding, sumOfBalances, address);
          } else 
            missingTokens.push(tokenConfig);
        }
        
        // Process missing tokens in batch
        tokenHoldingsMap = await processTokenBalances(
          address,
          missingTokens,
          tokenHoldingsMap,
          sumOfBalances
        );
        
        if(walletToNftHoldings.has(address)){
          for (const [nftAddress, holding] of walletToNftHoldings.get(address)!.entries()) {
            if(sumOfBalances && nftHoldingsMap[nftAddress]){
              nftHoldingsMap[nftAddress].tokenBalance = (+nftHoldingsMap[nftAddress].tokenBalance + +holding.tokenBalance).toString();
            }else if(!nftHoldingsMap[nftAddress] || holding.tokenBalance > nftHoldingsMap[nftAddress].tokenBalance){
              nftHoldingsMap[nftAddress] = holding;
            }
          }
        }
        
      }
      // Check basic badge eligibility
      if (basicRequirements) {
        let isBasicEligible = true;
        
        // Check token requirements
        if (basicRequirements.tokens && basicRequirements.tokens.length > 0) {
          for (const tokenConfig of basicRequirements.tokens) {            
            // Check if total balance meets requirement
            if (!tokenHoldingsMap[tokenConfig.address] || tokenHoldingsMap[tokenConfig.address].balanceFormatted < tokenConfig.minBalance) {
              isBasicEligible = false;
              logger.verboseLog(`${twitterHandle} does not meet basic requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenConfig.address]?.balanceFormatted } < ${tokenConfig.minBalance}`);
              break;
            }
            logger.verboseLog(`${twitterHandle} meets basic requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenConfig.address]?.balanceFormatted } >= ${tokenConfig.minBalance}`);
          }
        }
        
        // Check NFT requirements if still eligible
        if (isBasicEligible && basicRequirements.nfts && basicRequirements.nfts.length > 0) {
          for (const nftConfig of basicRequirements.nfts) {
            // Check if total NFTs meets requirement
            if (!nftHoldingsMap[nftConfig.address] || +nftHoldingsMap[nftConfig.address].tokenBalance < nftConfig.minBalance) {
              isBasicEligible = false;
              logger.verboseLog(`${twitterHandle} does not meet basic requirement for ${nftConfig.name}: ${nftHoldingsMap[nftConfig.address]?.tokenBalance} < ${nftConfig.minBalance}`);
              break;
            }
            logger.verboseLog(`${twitterHandle} meets basic requirement for ${nftConfig.name}: ${nftHoldingsMap[nftConfig.address]?.tokenBalance} >= ${nftConfig.minBalance}`);
          }
        }
        
        // Add to basic eligible handles if all requirements are met
        if (isBasicEligible) {
          basicEligibleHandles.add(twitterHandle);
          logger.verboseLog(`${twitterHandle} is eligible for basic badge`);
        }
      }
      
      // Check upgraded badge eligibility (if it exists)
      if (upgradedRequirements && basicEligibleHandles.has(twitterHandle)) {
        let isUpgradedEligible = true;
        
        // Check token requirements
        if (upgradedRequirements.tokens && upgradedRequirements.tokens.length > 0) {
          for (const tokenConfig of upgradedRequirements.tokens) {
            // Check if total balance meets requirement
            if (!tokenHoldingsMap[tokenConfig.address] || tokenHoldingsMap[tokenConfig.address].balanceFormatted < tokenConfig.minBalance) {
              isUpgradedEligible = false;
              logger.verboseLog(`${twitterHandle} does not meet upgraded requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenConfig.address]?.balanceFormatted} < ${tokenConfig.minBalance}`);
              break;
            }
            logger.verboseLog(`${twitterHandle} meets upgraded requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenConfig.address]?.balanceFormatted} >= ${tokenConfig.minBalance}`);
          }
        }
        
        // Check NFT requirements if still eligible
        if (isUpgradedEligible && upgradedRequirements.nfts && upgradedRequirements.nfts.length > 0) {
          for (const nftConfig of upgradedRequirements.nfts) {
            // Check if total NFTs meets requirement
            if (!nftHoldingsMap[nftConfig.address] || +nftHoldingsMap[nftConfig.address].tokenBalance < nftConfig.minBalance) {
              isUpgradedEligible = false;
              logger.verboseLog(`${twitterHandle} does not meet upgraded requirement for ${nftConfig.name}: ${nftHoldingsMap[nftConfig.address]?.tokenBalance} < ${nftConfig.minBalance}`);
              break;
            }
            logger.verboseLog(`${twitterHandle} meets upgraded requirement for ${nftConfig.name}: ${nftHoldingsMap[nftConfig.address]?.tokenBalance} >= ${nftConfig.minBalance}`);
          }
        }
        
        // Add to upgraded eligible handles if all requirements are met
        if (isUpgradedEligible) {
          upgradedEligibleHandles.add(twitterHandle);
          logger.verboseLog(`${twitterHandle} is eligible for upgraded badge`);
        }
      }
    }
    
    // Step 10: Apply excludeBasicForUpgraded flag if enabled
    if (excludeBasicForUpgraded) {
      logger.log('Applying excludeBasicForUpgraded flag...');
      
      // Remove handles from basic list if they are in the upgraded list
      for (const handle of upgradedEligibleHandles) {
        if (basicEligibleHandles.has(handle)) {
          basicEligibleHandles.delete(handle);
          logger.verboseLog(`Removed ${handle} from basic list because they have an upgraded badge`);
        }
      }
    }
    
    // Step 11: Add permanent accounts to both lists
    logger.log('Adding permanent accounts to badge lists...');
    for (const handle of permanentAccounts) {
      basicEligibleHandles.add(handle.toLowerCase());
      upgradedEligibleHandles.add(handle.toLowerCase());
    }
    
    // Step 12: Collect wallet addresses for eligible handles
    const basicEligibleAddresses = new Set<string>();
    const upgradedEligibleAddresses = new Set<string>();
    
    for (const [handle, holdings] of userWallets.entries()) {
      if (basicEligibleHandles.has(handle)) {
        for (const address of holdings) {
          basicEligibleAddresses.add(address);
        }
      }
      
      if (upgradedEligibleHandles.has(handle)) {
        for (const address of holdings) {
          upgradedEligibleAddresses.add(address);
        }
      }
    }
    // Add addresses from wallet mapping for permanent accounts that might not have been processed
    for (const handle of permanentAccounts) {
      let address: string | undefined;
      if (userWallets.has(handle) && userWallets.get(handle)!.size > 0) {
        address = Array.from(userWallets.get(handle)!)[0];
      } else {
        const arenaResponse = await getArenaAddressForHandle(handle);
        address = arenaResponse.address || undefined;
      }
      
      if (address) {
        basicEligibleAddresses.add(address);
        upgradedEligibleAddresses.add(address);
      }
    }
    
    // Step 13: Return the results
    const results: HolderResults = {
      basicHolders: Array.from(basicEligibleHandles),
      basicAddresses: Array.from(basicEligibleAddresses),
      timestamp: new Date().toISOString()
    };
    logger.log(`Found ${results.basicHolders.length} eligible basic badge holders`);
    // Only include upgraded data if there are upgraded requirements
    if (upgradedRequirements) {
      results.upgradedHolders = Array.from(upgradedEligibleHandles);
      results.upgradedAddresses = Array.from(upgradedEligibleAddresses);
      logger.log(`Found ${results.upgradedHolders.length} eligible upgraded badge holders`);
    }    
    
    return results;
  } catch (error) {
    logger.error('Error in fetchTokenHolderProfiles:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}
