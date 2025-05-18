// Token Holder Profiles Fetcher
import { TokenHolder, NftHolder, ArenabookUserResponse, TokenConfig, NftConfig, TokenHolding, NftHolding, AddressHoldings } from '../../types/interfaces';
import { loadWalletMapping, getHandleToWalletMapping, getArenaAddressForHandle } from '../../utils/walletMapping';
import { processHoldersWithSocials } from '../../services/socialProfiles';
import { fetchArenabookSocial } from '../../api/arenabook';
import { fetchNftHoldersFromEthers } from '../../api/blockchain';
import { formatTokenBalance, sleep, fetchTokenHolders } from '../../utils/helpers';
import { AppConfig } from '../../utils/config';
import { fetchTokenBalanceWithEthers } from '../../api/blockchain';

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
 * Helper function to combine token holders with the same Twitter handle
 */
async function combineTokenHolders(
  holders: TokenHolder[], 
  walletMapping: Record<string, string>,
  handleToWallet: Record<string, string>,
  minBalance: number
): Promise<TokenHolder[]> {

  
  console.log(`Combining token holders with sumOfBalances enabled...`);
  
  // Step 1: Identify holders with at least 50% of min balance
  const potentialHolders = holders.filter(holder => {
    const formattedBalance = formatTokenBalance(holder.balance);
    const requiredBalance = minBalance * 0.5;
    return formattedBalance >= requiredBalance;
  });
  
  console.log(`Found ${potentialHolders.length} holders with at least 50% of minimum balance`);
  
  // Step 2: Group holders by Twitter handle
  const holdersByHandle: Record<string, TokenHolder[]> = {};
  const arenaApiCache: Record<string, string | null> = {};
  
  // Process each potential holder
  for (const holder of potentialHolders) {
    const address = holder.address.toLowerCase();
    
    // Check if this address is in our wallet mapping
    if (walletMapping[address]) {
      const handle = walletMapping[address].toLowerCase();
      if (!holdersByHandle[handle]) {
        holdersByHandle[handle] = [];
      }
      holdersByHandle[handle].push(holder);
      continue;
    }
    
    // Fetch social profile from Arenabook
    try {
      const social = await fetchArenabookSocial(address);
      if (social && social.twitter_handle) {
        const handle = social.twitter_handle.toLowerCase();
        if (!holdersByHandle[handle]) {
          holdersByHandle[handle] = [];
        }
        holdersByHandle[handle].push(holder);
        
        // Check if there's another wallet for this handle in our mapping
        if (handleToWallet[handle] && handleToWallet[handle].toLowerCase() !== address) {
          // We already have this handle with a different address, so we'll combine them later
          console.log(`Found additional wallet ${address} for handle ${handle}`);
        }
      }
    } catch (error) {
      console.error(`Error fetching social profile for ${address}:`, error);
    }
    
    // Add a small delay to avoid rate limiting
    await sleep(REQUEST_DELAY_MS);
  }
  
  // Step 3: For handles in our mapping that don't have an Arena profile, fetch from Arena API
  for (const [address, handle] of Object.entries(walletMapping)) {
    const lowerHandle = handle.toLowerCase();
    const lowerAddress = address.toLowerCase();
    
    // Skip if we already have this handle
    if (holdersByHandle[lowerHandle]) {
      continue;
    }
    
    // Check if this address is in our potential holders
    const existingHolder = potentialHolders.find(h => h.address.toLowerCase() === lowerAddress);
    if (existingHolder) {
      if (!holdersByHandle[lowerHandle]) {
        holdersByHandle[lowerHandle] = [];
      }
      holdersByHandle[lowerHandle].push(existingHolder);
      continue;
    }
    
    // If not, try to fetch the Arena address for this handle
    if (!arenaApiCache[lowerHandle]) {
      try {
        const arenaAddress = await getArenaAddressForHandle(handle);
        arenaApiCache[lowerHandle] = arenaAddress;
        
        if (arenaAddress) {
          // Check if this address is in our potential holders
          const arenaHolder = potentialHolders.find(h => h.address.toLowerCase() === arenaAddress.toLowerCase());
          if (arenaHolder) {
            if (!holdersByHandle[lowerHandle]) {
              holdersByHandle[lowerHandle] = [];
            }
            holdersByHandle[lowerHandle].push(arenaHolder);
          }
        }
      } catch (error) {
        console.error(`Error fetching Arena address for handle ${handle}:`, error);
      }
      
      // Add a small delay to avoid rate limiting
      await sleep(REQUEST_DELAY_MS);
    }
  }
  
  // Step 4: Combine balances for each handle
  const combinedHolders: TokenHolder[] = [];
  
  for (const [handle, holders] of Object.entries(holdersByHandle)) {
    
    // Combine balances
    let totalFormattedBalance = 0;
    for (const holder of holders) {
      totalFormattedBalance += formatTokenBalance(holder.balance);
    }
    
    // Check if the combined balance meets the minimum
    if (totalFormattedBalance >= minBalance) {
      // Use the first holder as the base and update its balance
      const combinedHolder = { ...holders[0] };
      combinedHolder.balanceFormatted = totalFormattedBalance;
      // Convert back to raw balance string
      combinedHolder.balance = (totalFormattedBalance * Math.pow(10, 18)).toString();
      
      console.log(`Combined ${holders.length} wallets for ${handle} with total balance: ${totalFormattedBalance}`);
      combinedHolders.push(combinedHolder);
    }
  }
  
  console.log(`After combining, found ${combinedHolders.length} holders meeting minimum balance`);
  return combinedHolders;
}

/**
 * Helper function to combine NFT holders with the same Twitter handle
 */
async function combineNftHolders(
  holders: NftHolder[], 
  walletMapping: Record<string, string>,
  handleToWallet: Record<string, string>,
  minBalance: number
): Promise<NftHolder[]> {
  
  console.log(`Combining NFT holders with sumOfBalances enabled...`);
  
  // Step 1: Identify holders with at least 50% of min balance
  const potentialHolders = holders.filter(holder => holder.tokenCount >= Math.ceil(minBalance * 0.5));
  
  console.log(`Found ${potentialHolders.length} NFT holders with at least 50% of minimum balance`);
  
  // Step 2: Group holders by Twitter handle
  const holdersByHandle: Record<string, NftHolder[]> = {};
  const arenaApiCache: Record<string, string | null> = {};
  
  // Process each potential holder
  for (const holder of potentialHolders) {
    const address = holder.address.toLowerCase();
    
    // Check if this address is in our wallet mapping
    if (walletMapping[address]) {
      const handle = walletMapping[address].toLowerCase();
      if (!holdersByHandle[handle]) {
        holdersByHandle[handle] = [];
      }
      holdersByHandle[handle].push(holder);
      continue;
    }
    
    // Fetch social profile from Arenabook
    try {
      const social = await fetchArenabookSocial(address);
      if (social && social.twitter_handle) {
        const handle = social.twitter_handle.toLowerCase();
        if (!holdersByHandle[handle]) {
          holdersByHandle[handle] = [];
        }
        holdersByHandle[handle].push(holder);
        
        // Check if there's another wallet for this handle in our mapping
        if (handleToWallet[handle] && handleToWallet[handle].toLowerCase() !== address) {
          // We already have this handle with a different address, so we'll combine them later
          console.log(`Found additional wallet ${address} for handle ${handle}`);
        }
      } else if (walletMapping[address]) {
        // If the address is in our wallet mapping but doesn't have a social profile
        const handle = walletMapping[address].toLowerCase();
        if (!holdersByHandle[handle]) {
          holdersByHandle[handle] = [];
        }
        holdersByHandle[handle].push(holder);
      }
    } catch (error) {
      console.error(`Error fetching social profile for ${address}:`, error);
    }
    
    // Add a small delay to avoid rate limiting
    await sleep(REQUEST_DELAY_MS);
  }
  
  // Step 3: For handles in our mapping that don't have an Arena profile, fetch from Arena API
  for (const [address, handle] of Object.entries(walletMapping)) {
    const lowerHandle = handle.toLowerCase();
    const lowerAddress = address.toLowerCase();
    
    // Skip if we already have this handle
    if (holdersByHandle[lowerHandle]) {
      continue;
    }
    
    // Check if this address is in our potential holders
    const existingHolder = potentialHolders.find(h => h.address.toLowerCase() === lowerAddress);
    if (existingHolder) {
      if (!holdersByHandle[lowerHandle]) {
        holdersByHandle[lowerHandle] = [];
      }
      holdersByHandle[lowerHandle].push(existingHolder);
      continue;
    }
    
    // If not, try to fetch the Arena address for this handle
    if (!arenaApiCache[lowerHandle]) {
      try {
        const arenaAddress = await getArenaAddressForHandle(handle);
        arenaApiCache[lowerHandle] = arenaAddress;
        
        if (arenaAddress) {
          // Check if this address is in our potential holders
          const arenaHolder = potentialHolders.find(h => h.address.toLowerCase() === arenaAddress.toLowerCase());
          if (arenaHolder) {
            if (!holdersByHandle[lowerHandle]) {
              holdersByHandle[lowerHandle] = [];
            }
            holdersByHandle[lowerHandle].push(arenaHolder);
          }
        }
      } catch (error) {
        console.error(`Error fetching Arena address for handle ${handle}:`, error);
      }
      
      // Add a small delay to avoid rate limiting
      await sleep(REQUEST_DELAY_MS);
    }
  }
  
  // Step 4: Combine balances for each handle
  const combinedHolders: NftHolder[] = [];
  
  for (const [handle, holders] of Object.entries(holdersByHandle)) {
    if (holders.length === 0) {
      continue;
    }
    
    if (holders.length === 1) {
      // If there's only one holder for this handle, just check if it meets the minimum
      if (holders[0].tokenCount >= minBalance) {
        combinedHolders.push(holders[0]);
      }
      continue;
    }
    
    // Combine balances
    let totalTokenCount = 0;
    for (const holder of holders) {
      totalTokenCount += holder.tokenCount;
    }
    
    // Check if the combined balance meets the minimum
    if (totalTokenCount >= minBalance) {
      // Use the first holder as the base and update its token count
      const combinedHolder = { ...holders[0] };
      combinedHolder.tokenCount = totalTokenCount;
      
      console.log(`Combined ${holders.length} wallets for ${handle} with total NFT count: ${totalTokenCount}`);
      combinedHolders.push(combinedHolder);
    }
  }
  
  console.log(`After combining, found ${combinedHolders.length} NFT holders meeting minimum balance`);
  return combinedHolders;
}


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
    
    // Get wallet mapping file path from config (if it exists)
    const walletMappingFile = appConfig.projectConfig.walletMappingFile;
    
    // Initialize wallet mapping variables
    let walletMapping: Record<string, string> = {};
    let handleToWallet: Record<string, string> = {};
    
    if (walletMappingFile) {
      console.log(`Loading wallet mapping from ${walletMappingFile}...`);
      walletMapping = loadWalletMapping(walletMappingFile, appConfig.projectName);
      handleToWallet = getHandleToWalletMapping(walletMapping);
      console.log(`Loaded ${Object.keys(walletMapping).length} wallet-to-handle mappings`);
    } else {
      console.log(`No wallet mapping file specified. Skipping wallet mapping.`);
    }
    
    // Step 1: Collect all unique tokens and NFTs from both badge tiers
    const allTokens = new Set<TokenConfig>();
    const allNfts = new Set<NftConfig>();
    
    // Add tokens and NFTs from basic requirements
    if (basicRequirements.tokens) {
      basicRequirements.tokens.forEach(token => allTokens.add(token));
    }
    if (basicRequirements.nfts) {
      basicRequirements.nfts.forEach(nft => allNfts.add(nft));
    }
    
    // Add tokens and NFTs from upgraded requirements (if they exist)
    if (upgradedRequirements?.tokens) {
      upgradedRequirements.tokens.forEach(token => allTokens.add(token));
    }
    if (upgradedRequirements?.nfts) {
      upgradedRequirements.nfts.forEach(nft => allNfts.add(nft));
    }
    
    console.log(`Found ${allTokens.size} unique tokens and ${allNfts.size} unique NFTs across all badge tiers`);
    
    // Step 2: Create a map of token address to minimum balance required
    // If a token appears in both basic and upgraded, use the lower balance
    const tokenMinBalances = new Map<string, { minBalance: number, token: TokenConfig }>();
    
    // Process tokens from basic requirements
    if (basicRequirements.tokens) {
      for (const token of basicRequirements.tokens) {
        const lowerAddress = token.address.toLowerCase();
        let minBalance = token.minBalance;
        
        // If sumOfBalances is enabled, we can use half the minimum balance when fetching
        if (sumOfBalances) {
          minBalance = minBalance / 2;
        }
        
        tokenMinBalances.set(lowerAddress, { minBalance, token });
      }
    }
    
    // Process tokens from upgraded requirements (if they exist)
    if (upgradedRequirements?.tokens) {
      for (const token of upgradedRequirements.tokens) {
        const lowerAddress = token.address.toLowerCase();
        let minBalance = token.minBalance;
        
        // If sumOfBalances is enabled, we can use half the minimum balance when fetching
        if (sumOfBalances) {
          minBalance = minBalance / 2;
        }
        
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
    
    // Step 3: Create mappings to store token and NFT holdings by wallet address
    const walletToTokenHoldings = new Map<string, Map<string, TokenHolding>>();
    const walletToNftHoldings = new Map<string, Map<string, NftHolding>>();
    
    // Step 4: Fetch all addresses that have the minimum balance for each token
    console.log('Fetching token holders...');
    for (const [tokenAddress, { minBalance, token }] of tokenMinBalances.entries()) {
      console.log(`Fetching holders for ${token.symbol} (${tokenAddress}) with min balance ${minBalance}...`);
      
      // Fetch token holders with the minimum balance
      const tokenHolders = await fetchTokenHolders(
        tokenAddress,
        token.symbol,
        minBalance,
        token.decimals
      );
      
      console.log(`Found ${tokenHolders.length} holders for ${token.symbol} with balance >= ${minBalance}`);
      
      // Store token holdings for each wallet
      for (const holder of tokenHolders) {
        const walletAddress = holder.address.toLowerCase();
        
        // Initialize token holdings map for this wallet if it doesn't exist
        if (!walletToTokenHoldings.has(walletAddress)) {
          walletToTokenHoldings.set(walletAddress, new Map<string, TokenHolding>());
        }
        
        // Add token holding to the wallet's map
        const tokenHolding: TokenHolding = {
          tokenAddress: tokenAddress,
          tokenSymbol: token.symbol,
          tokenBalance: holder.balance,
          tokenDecimals: token.decimals
        };
        
        walletToTokenHoldings.get(walletAddress)!.set(tokenAddress, tokenHolding);
      }
    }
    
    // Step 5: Fetch all NFT holders for each NFT
    console.log('Fetching NFT holders...');
    for (const nft of allNfts) {
      const nftAddress = nft.address.toLowerCase();
      const minNftBalance = nft.minBalance;
      const collectionSize = nft.collectionSize || 1000; // Default to 1000 if not specified
      
      console.log(`Fetching holders for ${nft.name} (${nftAddress}) with min balance ${minNftBalance}...`);
      
      // Fetch NFT holders
      const nftHolders = await fetchNftHoldersFromEthers(
        nftAddress,
        nft.name,
        minNftBalance,
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
    const userHoldings = new Map<string, AddressHoldings[]>();
    
    // Step 7: Process wallets from the mapping file first
    if (Object.keys(walletMapping).length > 0) {
      console.log('Processing wallets from mapping file...');
      
      for (const [walletAddress, twitterHandle] of Object.entries(walletMapping)) {
        const lowerWalletAddress = walletAddress.toLowerCase();
        
        // Skip wallets that don't have any token or NFT holdings
        if (!walletToTokenHoldings.has(lowerWalletAddress) && !walletToNftHoldings.has(lowerWalletAddress)) {
          if (verbose) {
            console.log(`Wallet ${lowerWalletAddress} from mapping has no token or NFT holdings, skipping...`);
          }
          continue;
        }
        
        // Create address holdings object
        const addressHoldings: AddressHoldings = {
          address: lowerWalletAddress,
          tokenHoldings: {},
          nftHoldings: {},
          fromMapping: true
        };
        
        // Add token holdings
        if (walletToTokenHoldings.has(lowerWalletAddress)) {
          const tokenHoldings = walletToTokenHoldings.get(lowerWalletAddress)!;
          for (const [tokenAddress, tokenHolding] of tokenHoldings.entries()) {
            addressHoldings.tokenHoldings[tokenAddress] = tokenHolding;
          }
        }
        
        // Add NFT holdings
        if (walletToNftHoldings.has(lowerWalletAddress)) {
          const nftHoldings = walletToNftHoldings.get(lowerWalletAddress)!;
          for (const [nftAddress, nftHolding] of nftHoldings.entries()) {
            addressHoldings.nftHoldings[nftAddress] = nftHolding;
          }
        }
        
        // Add to user holdings map
        if (!userHoldings.has(twitterHandle)) {
          userHoldings.set(twitterHandle, []);
        }
        
        userHoldings.get(twitterHandle)!.push(addressHoldings);
      }
    }
    
    // Step 8: Process remaining wallets (not in mapping) by fetching Arena profiles
    console.log('Processing remaining wallets by fetching Arena profiles...');
    
    // Collect all wallet addresses that have token or NFT holdings
    const allWalletAddresses = new Set<string>();
    for (const walletAddress of walletToTokenHoldings.keys()) {
      allWalletAddresses.add(walletAddress);
    }
    for (const walletAddress of walletToNftHoldings.keys()) {
      allWalletAddresses.add(walletAddress);
    }
    
    // Filter out wallets that are already in the mapping
    const unmappedWallets = Array.from(allWalletAddresses).filter(
      address => !Object.keys(walletMapping).map(a => a.toLowerCase()).includes(address.toLowerCase())
    );
    
    console.log(`Found ${unmappedWallets.length} unmapped wallets with token or NFT holdings`);
    
    // Process unmapped wallets in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    for (let i = 0; i < unmappedWallets.length; i += BATCH_SIZE) {
      const batch = unmappedWallets.slice(i, i + BATCH_SIZE);
      
      if (verbose) {
        console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(unmappedWallets.length / BATCH_SIZE)}...`);
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
          
          const twitterHandle = profile.twitter_handle;
          
          // If sumOfBalances is false and we already have this Twitter handle, skip
          if (!sumOfBalances && userHoldings.has(twitterHandle)) {
            if (verbose) {
              console.log(`Twitter handle ${twitterHandle} already exists and sumOfBalances is disabled, skipping wallet ${walletAddress}...`);
            }
            return;
          }
          
          // Create address holdings object
          const addressHoldings: AddressHoldings = {
            address: walletAddress,
            tokenHoldings: {},
            nftHoldings: {},
            fromMapping: false
          };
          
          // Add token holdings
          if (walletToTokenHoldings.has(walletAddress)) {
            const tokenHoldings = walletToTokenHoldings.get(walletAddress)!;
            for (const [tokenAddress, tokenHolding] of tokenHoldings.entries()) {
              addressHoldings.tokenHoldings[tokenAddress] = tokenHolding;
            }
          }
          
          // Add NFT holdings
          if (walletToNftHoldings.has(walletAddress)) {
            const nftHoldings = walletToNftHoldings.get(walletAddress)!;
            for (const [nftAddress, nftHolding] of nftHoldings.entries()) {
              addressHoldings.nftHoldings[nftAddress] = nftHolding;
            }
          }
          
          // Add to user holdings map
          if (!userHoldings.has(twitterHandle)) {
            userHoldings.set(twitterHandle, []);
          }
          
          userHoldings.get(twitterHandle)!.push(addressHoldings);
          
        } catch (error) {
          console.error(`Error processing wallet ${walletAddress}:`, error);
        }
        
        // Add delay between requests to avoid rate limiting
        await sleep(REQUEST_DELAY_MS);
      });
      
      await Promise.all(promises);
    }
  
    // Step 9: Check eligibility for basic and upgraded badges
    console.log('Checking eligibility for badges...');
    
    // Initialize sets to store eligible Twitter handles
    const basicEligibleHandles = new Set<string>();
    const upgradedEligibleHandles = new Set<string>();
    
    // Check eligibility for each Twitter handle
    for (const [twitterHandle, addressHoldings] of userHoldings.entries()) {
      // Skip checking if this is a permanent account (they'll be added later)
      if (permanentAccounts.includes(twitterHandle)) {
        continue;
      }
      
      // Check basic badge eligibility
      if (basicRequirements) {
        let isBasicEligible = true;
        
        // Check token requirements
        if (basicRequirements.tokens && basicRequirements.tokens.length > 0) {
          for (const tokenConfig of basicRequirements.tokens) {
            const tokenAddress = tokenConfig.address.toLowerCase();
            const requiredBalance = tokenConfig.minBalance;
            
            let totalBalance = 0;
            
            if (sumOfBalances) {
              // Sum balances across all addresses for this user
              for (const holdings of addressHoldings) {
                // Check if we already have this token's balance
                if (holdings.tokenHoldings[tokenAddress]) {
                  const balanceStr = holdings.tokenHoldings[tokenAddress].tokenBalance;
                  const formattedBalance = formatTokenBalance(balanceStr, tokenConfig.decimals);
                  totalBalance += formattedBalance;
                } else {
                  // Fetch balance on-demand if not already fetched
                  const fetchedBalance = await fetchTokenBalanceWithEthers(
                    tokenAddress,
                    holdings.address,
                    tokenConfig.decimals,
                    verbose
                  );
                  totalBalance += fetchedBalance;
                }
              }
            } else {
              // Use only the first address
              const firstHolding = addressHoldings[0];
              if (firstHolding) {
                if (firstHolding.tokenHoldings[tokenAddress]) {
                  const balanceStr = firstHolding.tokenHoldings[tokenAddress].tokenBalance;
                  totalBalance = formatTokenBalance(balanceStr, tokenConfig.decimals);
                } else {
                  // Fetch balance on-demand if not already fetched
                  totalBalance = await fetchTokenBalanceWithEthers(
                    tokenAddress,
                    firstHolding.address,
                    tokenConfig.decimals,
                    verbose
                  );
                }
              }
            }
            
            // Check if total balance meets requirement
            if (totalBalance < requiredBalance) {
              isBasicEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet basic requirement for ${tokenConfig.symbol}: ${totalBalance} < ${requiredBalance}`);
              }
              break;
            }
          }
        }
        
        // Check NFT requirements if still eligible
        if (isBasicEligible && basicRequirements.nfts && basicRequirements.nfts.length > 0) {
          for (const nftConfig of basicRequirements.nfts) {
            const nftAddress = nftConfig.address.toLowerCase();
            const requiredBalance = nftConfig.minBalance;
            
            let totalNfts = 0;
            
            if (sumOfBalances) {
              // Sum NFT counts across all addresses for this user
              for (const holdings of addressHoldings) {
                if (holdings.nftHoldings[nftAddress]) {
                  const nftCount = parseInt(holdings.nftHoldings[nftAddress].tokenBalance);
                  totalNfts += nftCount;
                }
              }
            } else {
              // Use only the first address
              const firstHolding = addressHoldings[0];
              if (firstHolding && firstHolding.nftHoldings[nftAddress]) {
                totalNfts = parseInt(firstHolding.nftHoldings[nftAddress].tokenBalance);
              }
            }
            
            // Check if total NFTs meets requirement
            if (totalNfts < requiredBalance) {
              isBasicEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet basic requirement for ${nftConfig.name}: ${totalNfts} < ${requiredBalance}`);
              }
              break;
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
      if (upgradedRequirements) {
        let isUpgradedEligible = true;
        
        // Check token requirements
        if (upgradedRequirements.tokens && upgradedRequirements.tokens.length > 0) {
          for (const tokenConfig of upgradedRequirements.tokens) {
            const tokenAddress = tokenConfig.address.toLowerCase();
            const requiredBalance = tokenConfig.minBalance;
            
            let totalBalance = 0;
            
            if (sumOfBalances) {
              // Sum balances across all addresses for this user
              for (const holdings of addressHoldings) {
                // Check if we already have this token's balance
                if (holdings.tokenHoldings[tokenAddress]) {
                  const balanceStr = holdings.tokenHoldings[tokenAddress].tokenBalance;
                  const formattedBalance = formatTokenBalance(balanceStr, tokenConfig.decimals);
                  totalBalance += formattedBalance;
                } else {
                  // Fetch balance on-demand if not already fetched
                  const fetchedBalance = await fetchTokenBalanceWithEthers(
                    tokenAddress,
                    holdings.address,
                    tokenConfig.decimals,
                    verbose
                  );
                  totalBalance += fetchedBalance;
                }
              }
            } else {
              // Use only the first address
              const firstHolding = addressHoldings[0];
              if (firstHolding) {
                if (firstHolding.tokenHoldings[tokenAddress]) {
                  const balanceStr = firstHolding.tokenHoldings[tokenAddress].tokenBalance;
                  totalBalance = formatTokenBalance(balanceStr, tokenConfig.decimals);
                } else {
                  // Fetch balance on-demand if not already fetched
                  totalBalance = await fetchTokenBalanceWithEthers(
                    tokenAddress,
                    firstHolding.address,
                    tokenConfig.decimals,
                    verbose
                  );
                }
              }
            }
            
            // Check if total balance meets requirement
            if (totalBalance < requiredBalance) {
              isUpgradedEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet upgraded requirement for ${tokenConfig.symbol}: ${totalBalance} < ${requiredBalance}`);
              }
              break;
            }
          }
        }
        
        // Check NFT requirements if still eligible
        if (isUpgradedEligible && upgradedRequirements.nfts && upgradedRequirements.nfts.length > 0) {
          for (const nftConfig of upgradedRequirements.nfts) {
            const nftAddress = nftConfig.address.toLowerCase();
            const requiredBalance = nftConfig.minBalance;
            
            let totalNfts = 0;
            
            if (sumOfBalances) {
              // Sum NFT counts across all addresses for this user
              for (const holdings of addressHoldings) {
                if (holdings.nftHoldings[nftAddress]) {
                  const nftCount = parseInt(holdings.nftHoldings[nftAddress].tokenBalance);
                  totalNfts += nftCount;
                }
              }
            } else {
              // Use only the first address
              const firstHolding = addressHoldings[0];
              if (firstHolding && firstHolding.nftHoldings[nftAddress]) {
                totalNfts = parseInt(firstHolding.nftHoldings[nftAddress].tokenBalance);
              }
            }
            
            // Check if total NFTs meets requirement
            if (totalNfts < requiredBalance) {
              isUpgradedEligible = false;
              if (verbose) {
                console.log(`${twitterHandle} does not meet upgraded requirement for ${nftConfig.name}: ${totalNfts} < ${requiredBalance}`);
              }
              break;
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
    
    for (const [handle, holdings] of userHoldings.entries()) {
      if (basicEligibleHandles.has(handle)) {
        for (const holding of holdings) {
          basicEligibleAddresses.add(holding.address);
        }
      }
      
      if (upgradedEligibleHandles.has(handle)) {
        for (const holding of holdings) {
          upgradedEligibleAddresses.add(holding.address);
        }
      }
    }
    
    // Add addresses from wallet mapping for permanent accounts that might not have been processed
    for (const handle of permanentAccounts) {
      const address = handleToWallet[handle.toLowerCase()] ? handleToWallet[handle.toLowerCase()] : await getArenaAddressForHandle(handle);
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
