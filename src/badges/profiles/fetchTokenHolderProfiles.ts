// Token Holder Profiles Fetcher
import { TokenConfig, NftConfig, TokenHolding, NftHolding } from '../../types/interfaces';
import { loadWalletMapping, getHandleToWalletMapping, getArenaAddressForHandle } from '../../utils/walletMapping';
import { fetchArenabookSocial } from '../../api/arenabook';
import { fetchNftHoldersFromEthers } from '../../api/blockchain';
import { sleep, fetchTokenHolders, fetchTokenBalance } from '../../utils/helpers';
import { getTokensBalance } from '../../api/alchemy';
import { updateTokenHoldingsMap, createTokenHolding, processTokenBalances } from '../../utils/tokenUtils';
import { AppConfig } from '../../utils/config';

// Export the HolderResults interface for use in other files
export interface HolderResults {
  basicHolders: string[];
  upgradedHolders: string[];
  basicAddresses: string[];
  upgradedAddresses: string[];
}

// Constants
const REQUEST_DELAY_MS = 500; // 500ms delay between requests

/**
 * Main function to fetch token holder profiles
 */
export async function fetchTokenHolderProfiles(appConfig: AppConfig, verbose: boolean): Promise<HolderResults> {
  console.log(`Fetching token holder profiles for project: ${appConfig.projectName}`);
  
  try {
    // Get badge configurations with the project-specific config
    const basicRequirements = appConfig.badgeConfig.badges.basic;
    const upgradedRequirements = appConfig.badgeConfig.badges.upgraded || null;
    
    // Check if sum of balances feature is enabled
    const sumOfBalances = appConfig.badgeConfig.sumOfBalances || false;
    console.log(`Sum of balances feature is ${sumOfBalances ? 'enabled' : 'disabled'}`);
    
    // Get permanent accounts from project configuration
    const permanentAccounts = appConfig.badgeConfig.permanentAccounts || [];
    console.log(`Loaded ${permanentAccounts.length} permanent accounts: ${permanentAccounts.join(', ')}`);
    
    // Check if basic badges should be excluded for upgraded badge holders
    const excludeBasicForUpgraded = appConfig.badgeConfig.excludeBasicForUpgraded || false;
    console.log(`Exclude basic badges for upgraded badge holders: ${excludeBasicForUpgraded ? 'yes' : 'no'}`);
    

    
    // Step 1: Collect all unique tokens and NFTs from both badge tiers
    const allTokens = new Array<TokenConfig>();
    const allNfts = new Array<NftConfig>();
    
    console.log(`Found ${allTokens.length} unique tokens and ${allNfts.length} unique NFTs across all badge tiers`);
    
    // Step 2: Create a map of token address to minimum balance required
    // If a token appears in both basic and upgraded, use the lower balance
    const tokenMinBalances = new Map<string, { minBalance: number, token: TokenConfig }>();
    const nftMinBalances = new Map<string, { minBalance: number, nft: NftConfig }>();
    
    // Process tokens from basic requirements
    if (basicRequirements.tokens) {
      for (const token of basicRequirements.tokens) {
        if (!allTokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
          allTokens.push(token)
        }
        const lowerAddress = token.address.toLowerCase();
        let minBalance = token.minBalance;
        
        tokenMinBalances.set(lowerAddress, { minBalance, token });
      }
    }

    if (basicRequirements.nfts) {
      for (const nft of basicRequirements.nfts) {
        if (!allNfts.find(t => t.address.toLowerCase() === nft.address.toLowerCase())) {
          allNfts.push(nft)
        }
        const lowerAddress = nft.address.toLowerCase();
        let minBalance = nft.minBalance;
        
        nftMinBalances.set(lowerAddress, { minBalance, nft });
      }
    }
    // Process tokens from upgraded requirements (if they exist)
    if (upgradedRequirements?.tokens) {
      for (const token of upgradedRequirements.tokens) {
        if (!allTokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
          allTokens.push(token)
        }
        const lowerAddress = token.address.toLowerCase();
        let minBalance = token.minBalance;
        
        // If token already exists in the map, use the lower of the two balances
        if (tokenMinBalances.has(lowerAddress)) {
          const existingEntry = tokenMinBalances.get(lowerAddress)!;
          if (minBalance < existingEntry.minBalance) {
            tokenMinBalances.set(lowerAddress, { minBalance, token });
          }
        } else {
          tokenMinBalances.set(lowerAddress, { minBalance, token });
        }
      }
    }
    if (upgradedRequirements?.nfts) {
      for (const nft of upgradedRequirements.nfts) {
        if (!allNfts.find(t => t.address.toLowerCase() === nft.address.toLowerCase())) {
          allNfts.push(nft)
        }
        const lowerAddress = nft.address.toLowerCase();
        let minBalance = nft.minBalance;
        
        // If token already exists in the map, use the lower of the two balances
        if (nftMinBalances.has(lowerAddress)) {
          const existingEntry = nftMinBalances.get(lowerAddress)!;
          if (minBalance < existingEntry.minBalance) {
            nftMinBalances.set(lowerAddress, { minBalance, nft });
          }
        } else {
          nftMinBalances.set(lowerAddress, { minBalance, nft });
        }
      }
    }

    // Step 3: Create mappings to store token and NFT holdings by wallet address
    const walletToTokenHoldings = new Map<string, Map<string, TokenHolding>>();
    const walletToNftHoldings = new Map<string, Map<string, NftHolding>>();
    
    // Step 4: Fetch all addresses that have the minimum balance for each token
    console.log('Fetching token holders...');
    for (const [tokenAddress, { minBalance, token }] of tokenMinBalances.entries()) {
      let minBal = minBalance;
      if (sumOfBalances) {
        minBal = minBalance / 2;
      }
      console.log(`Fetching holders for ${token.symbol} (${tokenAddress}) with min balance ${minBal}...`);

      
      // Fetch token holders with the minimum balance
      const tokenHolders = await fetchTokenHolders(
        tokenAddress.toLowerCase(),
        token.symbol,
        minBal,
        token.decimals
      );
      
      console.log(`Found ${tokenHolders.length} holders for ${token.symbol} with balance >= ${minBal}`);
      
      // Store token holdings for each wallet
      for (const holder of tokenHolders) {
        const walletAddress = holder.address.toLowerCase();
        
        // Initialize token holdings map for this wallet if it doesn't exist
        if (!walletToTokenHoldings.has(walletAddress)) {
          walletToTokenHoldings.set(walletAddress, new Map<string, TokenHolding>());
        }
        
        walletToTokenHoldings.get(walletAddress)!.set(tokenAddress.toLowerCase(), holder.holding);
      }
    }
    const nftValidAddresses = new Set<string>();
    // Step 5: Fetch all NFT holders for each NFT
    console.log('Fetching NFT holders...');
    for (const nft of allNfts) {
      const nftAddress = nft.address.toLowerCase();
      let minNftBalance = nftMinBalances.get(nftAddress)!.minBalance;
      if (sumOfBalances) {
        minNftBalance = minNftBalance / 2;
      }
      const collectionSize = nft.collectionSize || 1000; // Default to 1000 if not specified
      
      console.log(`Fetching holders for ${nft.name} (${nftAddress}) with min balance ${minNftBalance}...`);
      
      // Fetch NFT holders
      const nftHolders = await fetchNftHoldersFromEthers(
        nftAddress,
        nft.name,
        1,
        verbose,
        collectionSize
      );
      
      console.log(`Found ${nftHolders.length} holders for ${nft.name} with balance >= ${minNftBalance}`);
      
      // Store NFT holdings for each wallet
      for (const holder of nftHolders) {
        const walletAddress = holder.address.toLowerCase();
        
        // Initialize NFT holdings map for this wallet if it doesn't exist
        if (!walletToNftHoldings.has(walletAddress)) {
          walletToNftHoldings.set(walletAddress, new Map<string, NftHolding>());
        }

        if (holder.tokenCount >= minNftBalance) {
          nftValidAddresses.add(walletAddress);
        }
        // Add NFT holding to the wallet's map
        const nftHolding: NftHolding = {
          tokenAddress: nftAddress,
          tokenSymbol: nft.name,
          tokenBalance: holder.tokenCount.toString()
        };
        
        walletToNftHoldings.get(walletAddress)!.set(nftAddress, nftHolding);
      }
    }
    
    // Step 6: Create a map of Twitter handle to address holdings
    let userWallets = new Map<string, Record<string, string>>();
    // Get wallet mapping file path from config (if it exists)
    const walletMappingFile = appConfig.projectConfig.walletMappingFile;

    if (walletMappingFile) {
      console.log(`Loading wallet mapping from ${walletMappingFile}...`);
      // Initialize wallet mapping variables
      let walletMapping: Record<string, string> = {};
      walletMapping = loadWalletMapping(walletMappingFile, appConfig.projectName);
      userWallets = getHandleToWalletMapping(walletMapping);
      console.log(`Loaded ${Object.keys(walletMapping).length} wallet-to-handle mappings`);
    } else {
      console.log(`No wallet mapping file specified. Skipping wallet mapping.`);
    }

    if(sumOfBalances){
      for (const handle of userWallets.keys()){
        if (verbose) console.log(`Fetching Arena profile for handle ${handle}...`);
        await sleep(500);
        const social = await getArenaAddressForHandle(handle);
        
        if (!social) {
          console.log(`No Arena address found for handle ${handle}`);
        }
        else{
          if (!userWallets.has(handle)){
            userWallets.set(handle, {});
          }
          if (!(userWallets.get(handle)![social.address.toLowerCase()])){
            if(verbose) console.log(`Adding Arena address for handle ${handle}: ${social.address}`);
            userWallets.get(handle)![social.address.toLowerCase()] = "arena";
          }
        } 
      }
    }
    // Step 8: Process remaining wallets (not in mapping) by fetching Arena profiles
    console.log('Processing remaining wallets by fetching Arena profiles...');
    
    // Collect all wallet addresses that have token or NFT holdings
    
    // Filter out wallets that are already in the mapping
    const allAddresses = new Set<string>([...walletToTokenHoldings.keys(), ... nftValidAddresses]);
    userWallets.forEach((value, key) => {
      allAddresses.delete(key);
    });
    const addressessToProcess = Array.from(allAddresses);
    
    console.log(`Found ${addressessToProcess.length} unmapped wallets with token or NFT holdings`);
    
    // Process unmapped wallets in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    for (let i = 0; i < addressessToProcess.length; i += BATCH_SIZE) {
      const batch = addressessToProcess.slice(i, i + BATCH_SIZE);
      
      if (verbose) {
        console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(addressessToProcess.length / BATCH_SIZE)}...`);
      }
      
      // Process wallets in parallel with rate limiting
      const promises = batch.map(async (walletAddress) => {
        try {
          // Fetch Arena profile for this wallet
          const profile = await fetchArenabookSocial(walletAddress);
          
          // Skip wallets without a Twitter handle
          if (!profile || !profile.twitter_handle) {
            if (verbose) {
              console.log(`No Twitter handle found for wallet ${walletAddress}, skipping...`);
            }
            return;
          }
          
          const twitterHandle = profile.twitter_handle.toLowerCase();

          if (!userWallets.has(twitterHandle)){
            userWallets.set(twitterHandle, {});
          }
          
          userWallets.get(twitterHandle)![walletAddress] = "arena";
          
        } catch (error) {
          console.error(`Error processing wallet ${walletAddress}:`, error);
        }
        
      });

      await Promise.all(promises);

      await sleep(REQUEST_DELAY_MS);
    }
  
    // Step 9: Check eligibility for basic and upgraded badges
    console.log('Checking eligibility for badges...');
    
    // Initialize sets to store eligible Twitter handles
    const basicEligibleHandles = new Set<string>();
    const upgradedEligibleHandles = new Set<string>();
    
    // Check eligibility for each Twitter handle
    for (const [twitterHandle, addressRecord] of userWallets.entries()) {
      // Skip checking if this is a permanent account (they'll be added later)
      if (permanentAccounts.includes(twitterHandle)) {
        continue;
      }
      const addressesToUse = Object.keys(addressRecord);
      // Skip if no address holdings
      if (addressesToUse.length === 0) continue;
      
     if (verbose) console.log(`Processing ${addressesToUse.length} addresses for Twitter handle ${twitterHandle}`);
      let tokenHoldingsMap: {[key:string]:TokenHolding} = {};
      const nftHoldingsMap: {[key:string]:NftHolding} = {};
  
      // Process each address
      for (const address of addressesToUse) {
        if (verbose) console.log(`Processing address ${address} for Twitter handle ${twitterHandle}`);
        
        // Process token holdings
        const missingTokens: TokenConfig[] = [];
        
        for (const tokenConfig of allTokens) {
          const tokenAddress = tokenConfig.address.toLowerCase();
          
          if (walletToTokenHoldings.has(address) && walletToTokenHoldings.get(address)!.has(tokenAddress)) {
            const holding = walletToTokenHoldings.get(address)!.get(tokenAddress)!;
            tokenHoldingsMap = updateTokenHoldingsMap(tokenHoldingsMap, tokenAddress, holding, sumOfBalances, verbose, address);
          } else {
            // Store missing token configs for batch processing
            missingTokens.push(tokenConfig);
          }
        }
        
        // Process missing tokens in batch
        if (missingTokens.length > 0) {
          tokenHoldingsMap = await processTokenBalances(
            address,
            missingTokens,
            tokenHoldingsMap,
            sumOfBalances,
            verbose
          );
        }
        
        if(walletToNftHoldings.has(address)){
          const nftHoldings = walletToNftHoldings.get(address)!;
          for (const [nftAddress, holding] of nftHoldings.entries()) {
            if(nftHoldingsMap[nftAddress]){
              if(sumOfBalances){
                nftHoldingsMap[nftAddress].tokenBalance = (+nftHoldingsMap[nftAddress].tokenBalance + +holding.tokenBalance).toString();
              }else{
                if(holding.tokenBalance > nftHoldingsMap[nftAddress].tokenBalance){
                  nftHoldingsMap[nftAddress] = holding;
                }
              }
            }else nftHoldingsMap[nftAddress] = holding;
          }
        }
        
      }
      // Check basic badge eligibility
      if (basicRequirements) {
        let isBasicEligible = true;
        
        // Check token requirements
        if (basicRequirements.tokens && basicRequirements.tokens.length > 0) {
          for (const tokenConfig of basicRequirements.tokens) {
            const tokenAddress = tokenConfig.address.toLowerCase();
            const requiredBalance = tokenConfig.minBalance;
            
            // Check if total balance meets requirement
            if (!tokenHoldingsMap[tokenAddress] || tokenHoldingsMap[tokenAddress].balanceFormatted < requiredBalance) {
              isBasicEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet basic requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenAddress]?.balanceFormatted } < ${requiredBalance}`);
              }
              break;
            }
            if (verbose) {
              console.log(`${twitterHandle} meets basic requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenAddress]?.balanceFormatted } >= ${requiredBalance}`);
            }
          }
        }
        
        // Check NFT requirements if still eligible
        if (isBasicEligible && basicRequirements.nfts && basicRequirements.nfts.length > 0) {
          for (const nftConfig of basicRequirements.nfts) {
            const nftAddress = nftConfig.address.toLowerCase();
            const requiredBalance = nftConfig.minBalance;
            
            
            // Check if total NFTs meets requirement
            if (!nftHoldingsMap[nftAddress] || +nftHoldingsMap[nftAddress].tokenBalance < requiredBalance) {
              isBasicEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet basic requirement for ${nftConfig.name}: ${nftHoldingsMap[nftAddress]?.tokenBalance} < ${requiredBalance}`);
              }
              break;
            }
            if (verbose) {
              console.log(`${twitterHandle} meets basic requirement for ${nftConfig.name}: ${nftHoldingsMap[nftAddress]?.tokenBalance} >= ${requiredBalance}`);
            }
          }
        }
        
        // Add to basic eligible handles if all requirements are met
        if (isBasicEligible) {
          basicEligibleHandles.add(twitterHandle);
          if (verbose) {
            console.log(`${twitterHandle} is eligible for basic badge`);
          }
        }
      }
      
      // Check upgraded badge eligibility (if it exists)
      if (upgradedRequirements && basicEligibleHandles.has(twitterHandle)) {
        let isUpgradedEligible = true;
        
        // Check token requirements
        if (upgradedRequirements.tokens && upgradedRequirements.tokens.length > 0) {
          for (const tokenConfig of upgradedRequirements.tokens) {
            const tokenAddress = tokenConfig.address.toLowerCase();
            const requiredBalance = tokenConfig.minBalance;
            
            // Check if total balance meets requirement
            if (!tokenHoldingsMap[tokenAddress] || tokenHoldingsMap[tokenAddress].balanceFormatted < requiredBalance) {
              isUpgradedEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet upgraded requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenAddress]?.balanceFormatted} < ${requiredBalance}`);
              }
              break;
            }
            if (verbose) {
              console.log(`${twitterHandle} meets upgraded requirement for ${tokenConfig.symbol}: ${tokenHoldingsMap[tokenAddress]?.balanceFormatted} >= ${requiredBalance}`);
            }
          }
        }
        
        // Check NFT requirements if still eligible
        if (isUpgradedEligible && upgradedRequirements.nfts && upgradedRequirements.nfts.length > 0) {
          for (const nftConfig of upgradedRequirements.nfts) {
            const nftAddress = nftConfig.address.toLowerCase();
            const requiredBalance = nftConfig.minBalance;
            
            // Check if total NFTs meets requirement
            if (!nftHoldingsMap[nftAddress] || +nftHoldingsMap[nftAddress].tokenBalance < requiredBalance) {
              isUpgradedEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet upgraded requirement for ${nftConfig.name}: ${nftHoldingsMap[nftAddress]?.tokenBalance} < ${requiredBalance}`);
              }
              break;
            }
            if (verbose) {
              console.log(`${twitterHandle} meets upgraded requirement for ${nftConfig.name}: ${nftHoldingsMap[nftAddress]?.tokenBalance} >= ${requiredBalance}`);
            }
          }
        }
        
        // Add to upgraded eligible handles if all requirements are met
        if (isUpgradedEligible) {
          upgradedEligibleHandles.add(twitterHandle);
          if (verbose) {
            console.log(`${twitterHandle} is eligible for upgraded badge`);
          }
        }
      }
    }
    
    // Step 10: Apply excludeBasicForUpgraded flag if enabled
    if (excludeBasicForUpgraded) {
      console.log('Applying excludeBasicForUpgraded flag...');
      
      // Remove handles from basic list if they are in the upgraded list
      for (const handle of upgradedEligibleHandles) {
        if (basicEligibleHandles.has(handle)) {
          basicEligibleHandles.delete(handle);
          if (verbose) {
            console.log(`Removed ${handle} from basic list because they have an upgraded badge`);
          }
        }
      }
    }
    
    // Step 11: Add permanent accounts to both lists
    console.log('Adding permanent accounts to badge lists...');
    for (const handle of permanentAccounts) {
      basicEligibleHandles.add(handle);
      upgradedEligibleHandles.add(handle);
    }
    
    // Step 12: Collect wallet addresses for eligible handles
    const basicEligibleAddresses = new Set<string>();
    const upgradedEligibleAddresses = new Set<string>();
    
    for (const [handle, holdings] of userWallets.entries()) {
      if (basicEligibleHandles.has(handle)) {
        for (const holding of Object.keys(holdings)) {
          basicEligibleAddresses.add(holding);
        }
      }
      
      if (upgradedEligibleHandles.has(handle)) {
        for (const holding of Object.keys(holdings)) {
          upgradedEligibleAddresses.add(holding);
        }
      }
    }
    
    // Add addresses from wallet mapping for permanent accounts that might not have been processed
    for (const handle of permanentAccounts) {
      const address = userWallets.has(handle) ? Object.keys(userWallets.get(handle)!)[0] : Object.keys(await getArenaAddressForHandle(handle))[0];
      if (address) {
        basicEligibleAddresses.add(address);
        upgradedEligibleAddresses.add(address);
      }
    }
    
    // Step 13: Return the results
    const results: HolderResults = {
      basicHolders: Array.from(basicEligibleHandles),
      upgradedHolders: Array.from(upgradedEligibleHandles),
      basicAddresses: Array.from(basicEligibleAddresses),
      upgradedAddresses: Array.from(upgradedEligibleAddresses)
    };
    
    console.log(`Found ${results.basicHolders.length} eligible basic badge holders`);
    console.log(`Found ${results.upgradedHolders.length} eligible upgraded badge holders`);
    
    return results;
  } catch (error) {
    console.error('Error in fetchTokenHolderProfiles:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}
