// Token Holder Profiles Fetcher
import { TokenHolder, NftHolder, ArenabookUserResponse } from '../../types/interfaces';
import { loadWalletMapping, getHandleToWalletMapping, getArenaAddressForHandle } from '../../utils/walletMapping';
import { processHoldersWithSocials } from '../../services/socialProfiles';
import { fetchArenabookSocial } from '../../api/arenabook';
import { fetchNftHoldersFromEthers } from '../../api/blockchain';
import { fetchTokenHoldersFromSnowtrace } from '../../api/snowtrace';
import { formatTokenBalance, sleep } from '../../utils/helpers';
import { AppConfig } from '../../utils/config';

// Export the HolderResults interface for use in other files
export interface HolderResults {
  basicHolders: string[];
  upgradedHolders: string[];
  basicAddresses: string[];
  upgradedAddresses: string[];
}

// For backward compatibility, define the same interfaces
interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  minBalance: number;
}

// Constants
const REQUEST_DELAY_MS = 500; // 500ms delay between requests

/**
 * Check if a token balance meets the minimum requirement
 */
function hasMinimumBalance(balance: string, minBalance: number): boolean {
  return formatTokenBalance(balance) >= minBalance;
}

/**
 * Helper function to combine token holders with the same Twitter handle
 */
async function combineTokenHolders(
  holders: TokenHolder[], 
  walletMapping: Record<string, string>,
  handleToWallet: Record<string, string>,
  minBalance: number,
  sumOfBalances: boolean
): Promise<TokenHolder[]> {
  // If sumOfBalances is false, just return the original holders
  if (!sumOfBalances) {
    return holders.filter(holder => 
      hasMinimumBalance(holder.balance, minBalance)
    );
  }
  
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
  const combinedHolders: TokenHolder[] = [];
  
  for (const [handle, holders] of Object.entries(holdersByHandle)) {
    if (holders.length === 0) {
      continue;
    }
    
    if (holders.length === 1) {
      // If there's only one holder for this handle, just check if it meets the minimum
      if (hasMinimumBalance(holders[0].balance, minBalance)) {
        combinedHolders.push(holders[0]);
      }
      continue;
    }
    
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
  minBalance: number,
  sumOfBalances: boolean
): Promise<NftHolder[]> {
  // If sumOfBalances is false, just return the original holders
  if (!sumOfBalances) {
    return holders.filter(holder => holder.tokenCount >= minBalance);
  }
  
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
  
  // Get badge configurations with the project-specific config
  const basicRequirements = appConfig.badgeConfig.badges?.basic || { nfts: [], tokens: [] };
  const upgradedRequirements = appConfig.badgeConfig.badges?.upgraded || { nfts: [], tokens: [] };
  
  // Get NFT configurations
  const BASIC_NFT_CONFIG = basicRequirements.nfts && basicRequirements.nfts.length > 0 ? basicRequirements.nfts[0] : null;
  const UPGRADED_NFT_CONFIG = upgradedRequirements.nfts && upgradedRequirements.nfts.length > 0 ? upgradedRequirements.nfts[0] : null;
  
  // Use basic NFT config if available, otherwise use upgraded NFT config
  const NFT_CONFIG = BASIC_NFT_CONFIG || UPGRADED_NFT_CONFIG;
  const NFT_CONTRACT = NFT_CONFIG?.address || '';
  const NFT_NAME = NFT_CONFIG?.name || 'Unknown NFT';
  const MIN_NFT_BALANCE = NFT_CONFIG?.minBalance || 1;
  const NFT_COLLECTION_SIZE = NFT_CONFIG?.collectionSize || 1000; // Default to 1000 if not specified
  
  // Create mappings from configuration
  const TOKEN_SYMBOLS: { [key: string]: string } = {};
  const TOKEN_DECIMALS: { [key: string]: number } = {};
  
  // Create separate mappings for basic and upgraded token balances
  const BASIC_TOKEN_BALANCES: { [key: string]: number } = {};
  const UPGRADED_TOKEN_BALANCES: { [key: string]: number } = {};
  
  // Initialize token mappings from basic requirements
  if (basicRequirements.tokens) {
    console.log(`Found ${basicRequirements.tokens.length} tokens in basic requirements`);
    basicRequirements.tokens.forEach((token: TokenConfig) => {
      console.log(`Processing basic token: ${token.symbol} (${token.address}) with min balance: ${token.minBalance}`);
      const lowerAddress = token.address.toLowerCase();
      BASIC_TOKEN_BALANCES[lowerAddress] = token.minBalance;
      TOKEN_SYMBOLS[lowerAddress] = token.symbol;
      TOKEN_DECIMALS[lowerAddress] = token.decimals;
    });
  } else {
    console.log('No tokens found in basic requirements');
  }
  
  // Initialize token mappings from upgraded requirements
  if (upgradedRequirements.tokens) {
    console.log(`Found ${upgradedRequirements.tokens.length} tokens in upgraded requirements`);
    upgradedRequirements.tokens.forEach((token: TokenConfig) => {
      console.log(`Processing upgraded token: ${token.symbol} (${token.address}) with min balance: ${token.minBalance}`);
      const lowerAddress = token.address.toLowerCase();
      UPGRADED_TOKEN_BALANCES[lowerAddress] = token.minBalance;
      TOKEN_SYMBOLS[lowerAddress] = token.symbol;
      TOKEN_DECIMALS[lowerAddress] = token.decimals;
    });
  } else {
    console.log('No tokens found in upgraded requirements');
  }
  
  // Get permanent accounts from project configuration
  let PERMANENT_ACCOUNTS: string[] = [];
  try {
    // Get from project configuration
    if (appConfig && appConfig.badgeConfig.permanentAccounts && Array.isArray(appConfig.badgeConfig.permanentAccounts)) {
      PERMANENT_ACCOUNTS = appConfig.badgeConfig.permanentAccounts;
      console.log(`Loaded ${PERMANENT_ACCOUNTS.length} permanent accounts from project config: ${PERMANENT_ACCOUNTS.join(', ')}`);
    } else {
      console.log('No permanent accounts found in project config');
    }
  } catch (error) {
    console.error('Error loading permanent accounts:', error);
  }
  
  // Check if sum of balances feature is enabled
  const sumOfBalances = appConfig.badgeConfig.sumOfBalances || false;
  
  // Initialize wallet mapping variables
  let walletMapping: Record<string, string> = {};
  let handleToWallet: Record<string, string> = {};
  
  // Get wallet mapping file path from config (if it exists)
  const walletMappingFile = appConfig.projectConfig.walletMappingFile;
  
  if (walletMappingFile) {
    if (sumOfBalances) {
      console.log(`Sum of balances feature is enabled. Loading wallet mapping from ${walletMappingFile}...`);
    } else {
      console.log(`Loading wallet mapping from ${walletMappingFile} for social profile matching...`);
    }
    
    walletMapping = loadWalletMapping(walletMappingFile, appConfig.projectName);
    handleToWallet = getHandleToWalletMapping(walletMapping);
    console.log(`Loaded ${Object.keys(walletMapping).length} wallet-to-handle mappings`);
  } else {
    console.log(`No wallet mapping file specified. Skipping wallet mapping.`);
  }
  
  try {
    // Fetch token holders first (since we'll filter by token balance before fetching social profiles)
    let tokenHolders: TokenHolder[] = [];
    
    // Combine token addresses from both basic and upgraded requirements
    const basicTokenAddresses = Object.keys(BASIC_TOKEN_BALANCES);
    const upgradedTokenAddresses = Object.keys(UPGRADED_TOKEN_BALANCES);
    const tokenAddresses = [...new Set([...basicTokenAddresses, ...upgradedTokenAddresses])];
    
    if (tokenAddresses.length > 0) {
      // Use the first token for now (can be expanded to support multiple tokens)
      const tokenAddress = tokenAddresses[0];
      const basicBalance = BASIC_TOKEN_BALANCES[tokenAddress] || 0;
      const upgradedBalance = UPGRADED_TOKEN_BALANCES[tokenAddress] || 0;
      console.log(`Token to check: ${TOKEN_SYMBOLS[tokenAddress]} (${tokenAddress})`);
      console.log(`Basic min balance: ${basicBalance}, Upgraded min balance: ${upgradedBalance}`);
      
      // Fetch token holders from Snowtrace
      const symbol = TOKEN_SYMBOLS[tokenAddress.toLowerCase()] || 'Unknown Token';
      const decimals = TOKEN_DECIMALS[tokenAddress.toLowerCase()] || 18;
      const rawTokenHolders = await fetchTokenHoldersFromSnowtrace(tokenAddress, symbol, 0, decimals);
      
      // Process token holders with wallet mapping
      if (walletMappingFile) {
        if (sumOfBalances) {
          console.log('Sum of balances feature is enabled for tokens. Processing token holders with wallet mapping...');
          
          // Process basic token holders
          if (basicBalance > 0) {
            const basicTokenHolders = await combineTokenHolders(
              rawTokenHolders,
              walletMapping,
              handleToWallet,
              basicBalance,
              sumOfBalances
            );
            console.log(`After combining, found ${basicTokenHolders.length} token holders meeting basic minimum balance`);
          }
          
          // Process upgraded token holders
          if (upgradedBalance > 0) {
            const upgradedTokenHolders = await combineTokenHolders(
              rawTokenHolders,
              walletMapping,
              handleToWallet,
              upgradedBalance,
              sumOfBalances
            );
            console.log(`After combining, found ${upgradedTokenHolders.length} token holders meeting upgraded minimum balance`);
          }
        } else {
          console.log('Using wallet mapping for social profile matching without combining balances...');
          // When sumOfBalances is false, we still want to use the wallet mapping for social profile matching
          // but we don't want to combine balances
        }
      } else {
        console.log('No wallet mapping file specified, using raw token holders...');
      }
      
      // Use the raw token holders for further processing regardless of sumOfBalances setting
      tokenHolders = rawTokenHolders;
    } else {
      console.log('No token addresses configured, skipping token holder fetching');
    }
    
    // Fetch NFT holders if needed
    let nftHolders: NftHolder[] = [];
    if (NFT_CONTRACT) {
      console.log(`NFT to check: ${NFT_NAME} (${NFT_CONTRACT}) (min balance: ${MIN_NFT_BALANCE})`);
      
      // Pass all required parameters to fetchNftHoldersFromEthers
      const rawNftHolders = await fetchNftHoldersFromEthers(NFT_CONTRACT, NFT_NAME, MIN_NFT_BALANCE, true); // Set verbose to true
      
      // Process NFT holders with wallet mapping if sum of balances is enabled
      if (sumOfBalances) {
        console.log('Sum of balances feature is enabled for NFTs. Processing NFT holders with wallet mapping...');
        nftHolders = await combineNftHolders(
          rawNftHolders,
          walletMapping,
          handleToWallet,
          MIN_NFT_BALANCE,
          sumOfBalances
        );
      } else {
        // If sum of balances is disabled, just use the raw NFT holders
        nftHolders = rawNftHolders;
      }
    } else {
      console.log('No NFT contract configured, skipping NFT holder fetching');
    }
    
    // First, determine which addresses qualify for basic and upgraded badges
    
    // For basic badge, start with NFT holders
    let basicAddresses = new Set<string>();
    
    // If basic requirements include NFTs
    if (BASIC_NFT_CONFIG) {
      console.log("Basic badge requires NFT holdings");
      basicAddresses = new Set(nftHolders.map(h => h.address.toLowerCase()));
    }
    
    // If basic requirements include tokens
    if (basicRequirements.tokens && basicRequirements.tokens.length > 0) {
      console.log("Basic badge requires token holdings");
      const requiredToken = basicRequirements.tokens[0];
      const requiredBalance = requiredToken.minBalance;
      
      // Log the basic token balance requirement
      console.log(`Basic badge token requirement: ${requiredToken.symbol} (${requiredToken.address}) with min balance: ${requiredBalance}`);
      
      if (basicAddresses.size === 0) {
        // If no NFT requirement, use token holders directly
        console.log('Checking token balances for basic badge qualification:');
        
        // Check each holder against the BASIC token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          if (formatTokenBalance(holder.balance) >= requiredBalance) {
            qualifyingHolders.push(holder);
          }
        }
        
        console.log(`Found ${qualifyingHolders.length} addresses that qualify for the basic badge`);
        console.log(`Basic badge holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        basicAddresses = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
      } else {
        // If both NFT and token requirements, filter to addresses that have both
        console.log('Checking token balances for basic badge qualification:');
        
        // Check each holder against the BASIC token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          if (formatTokenBalance(holder.balance) >= requiredBalance) {
            qualifyingHolders.push(holder);
          }
        }
        console.log(`Basic badge holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        const tokenAddressesWithMinBalance = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
        
        const previousSize = basicAddresses.size;
        basicAddresses = new Set(
          [...basicAddresses].filter(address => tokenAddressesWithMinBalance.has(address))
        );
        console.log(`Addresses that have both NFT and tokens for basic badge: ${basicAddresses.size} (reduced from ${previousSize})`);
      }
    }
    
    console.log(`Found ${basicAddresses.size} addresses that qualify for the basic badge`);
    
    // For upgraded badge
    let upgradedAddresses = new Set<string>();
    
    // If upgraded requirements include NFTs
    if (UPGRADED_NFT_CONFIG) {
      console.log("Upgraded badge requires NFT holdings");
      upgradedAddresses = new Set(nftHolders.map(h => h.address.toLowerCase()));
    }
    
    // If upgraded requirements include tokens
    if (upgradedRequirements.tokens && upgradedRequirements.tokens.length > 0) {
      console.log("Upgraded badge requires token holdings");
      const requiredToken = upgradedRequirements.tokens[0];
      const requiredBalance = requiredToken.minBalance;
      
      console.log(`Upgraded badge token requirement: ${requiredToken.symbol} (${requiredToken.address}) with min balance: ${requiredBalance}`);
      console.log(`Token holders found: ${tokenHolders.length}`);
      
      if (tokenHolders.length === 0) {
        console.log('WARNING: No token holders found. Check if the token address is correct and if the Snowtrace API is working.');
      }
      
      if (upgradedAddresses.size === 0) {
        // If no NFT requirement, use token holders directly
        console.log('Checking token balances for upgraded badge qualification:');
        
        // Check each holder against the UPGRADED token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          if (formatTokenBalance(holder.balance) >= requiredBalance) {
            qualifyingHolders.push(holder);
          }
        }
        
        console.log(`Found ${qualifyingHolders.length} addresses that qualify for the upgraded badge`);
        console.log(`Holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        upgradedAddresses = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
      } else {
        // If both NFT and token requirements, filter to addresses that have both
        console.log('Checking token balances for upgraded badge qualification:');
        
        // Check each holder against the UPGRADED token balance requirement
        const qualifyingHolders = [];
        for (const holder of tokenHolders) {
          if (formatTokenBalance(holder.balance) >= requiredBalance) {
            qualifyingHolders.push(holder);
          }
        }
        
        console.log(`Holders with sufficient balance: ${qualifyingHolders.length}/${tokenHolders.length}`);
        
        const tokenAddressesWithMinBalance = new Set(
          qualifyingHolders.map(h => h.address.toLowerCase())
        );
        
        const previousSize = upgradedAddresses.size;
        upgradedAddresses = new Set(
          [...upgradedAddresses].filter(address => tokenAddressesWithMinBalance.has(address))
        );
        console.log(`Addresses that have both NFT and tokens: ${upgradedAddresses.size} (reduced from ${previousSize})`);
      }
    } else {
      console.log("No token requirements found for upgraded badge");
    }
    
    console.log(`Found ${upgradedAddresses.size} addresses that qualify for the upgraded badge`);
    
    // Combine all qualifying addresses to fetch social profiles only for those
    const allQualifyingAddresses = new Set<string>([...basicAddresses, ...upgradedAddresses]);
    console.log(`Total unique qualifying addresses: ${allQualifyingAddresses.size}`);
    
    // Create a combined list of addresses to process for social profiles
    // This includes both token holders and NFT holders
    const addressesToProcess: { address: string, balance?: string, balanceFormatted?: number, tokenSymbol?: string, tokenCount?: number }[] = [];
    
    // Add qualifying token holders
    tokenHolders.forEach(holder => {
      if (allQualifyingAddresses.has(holder.address.toLowerCase())) {
        addressesToProcess.push(holder);
      }
    });
    
    // Add NFT holders that aren't already in the list
    const processedAddresses = new Set(addressesToProcess.map(a => a.address.toLowerCase()));
    nftHolders.forEach(holder => {
      if (allQualifyingAddresses.has(holder.address.toLowerCase()) && !processedAddresses.has(holder.address.toLowerCase())) {
        addressesToProcess.push({
          address: holder.address,
          balance: holder.tokenCount.toString(),
          balanceFormatted: holder.tokenCount,
          tokenSymbol: NFT_NAME
        });
      }
    });
    
    console.log(`Fetching social profiles for ${addressesToProcess.length} qualifying addresses (${allQualifyingAddresses.size} unique addresses)`);
    
    // Process all qualifying addresses to get their Twitter handles
    const socialInfoMap = await processHoldersWithSocials<typeof addressesToProcess[0]>(
      addressesToProcess,
      (holder: typeof addressesToProcess[0], social: ArenabookUserResponse | null) => ({
        ...holder,
        twitter_handle: social?.twitter_handle || null,
        twitter_pfp_url: social?.twitter_pfp_url || null
      }),
      // Pass wallet mapping regardless of sumOfBalances setting
      walletMapping,
      false
    );
    
    // Convert SocialProfileInfo map to simple twitter handle map for backward compatibility
    const addressToTwitterHandle = new Map<string, string | null>();
    for (const [address, socialInfo] of socialInfoMap.entries()) {
      addressToTwitterHandle.set(address, socialInfo.twitter_handle);
    }
    
    // Get Twitter handles for basic badge holders and their corresponding addresses
    const basicHandlesAndAddresses = [...basicAddresses]
      .map(address => {
        const handle = addressToTwitterHandle.get(address);
        return { address, handle };
      })
      .filter(item => item.handle !== null);
    
    const basicHandles = basicHandlesAndAddresses.map(item => item.handle) as string[];
    const basicSocialAddresses = basicHandlesAndAddresses.map(item => item.address);
      
    // Get Twitter handles for upgraded badge holders and their corresponding addresses
    const upgradedHandlesAndAddresses = [...upgradedAddresses]
      .map(address => {
        const handle = addressToTwitterHandle.get(address);
        return { address, handle };
      })
      .filter(item => item.handle !== null);
    
    const upgradedHandles = upgradedHandlesAndAddresses.map(item => item.handle) as string[];
    const upgradedSocialAddresses = upgradedHandlesAndAddresses.map(item => item.address);
    
    // Flag to control whether holders can be in both lists
    const excludeBasicForUpgraded = appConfig.badgeConfig.excludeBasicForUpgraded === true;
    
    // If excludeBasicForUpgraded is true, remove upgraded badge holders from basic badge list
    // but NEVER remove permanent accounts
    let filteredBasicHandles = basicHandles;
    if (excludeBasicForUpgraded) {
      console.log('Removing upgraded badge holders from basic badge list due to excludeBasicForUpgraded flag');
      // Create a set of upgraded handles for faster lookups
      const upgradedHandlesSet = new Set(upgradedHandles);
      // Create a set of permanent accounts for faster lookups
      const permanentAccountsSet = new Set(PERMANENT_ACCOUNTS.map(handle => handle.toLowerCase()));
      
      // Filter out basic handles that are also in upgraded handles, but keep permanent accounts
      filteredBasicHandles = basicHandles.filter(handle => 
        !upgradedHandlesSet.has(handle) || permanentAccountsSet.has(handle.toLowerCase())
      );
      console.log(`Removed ${basicHandles.length - filteredBasicHandles.length} handles from basic badge list (permanent accounts preserved)`);
    } else {
      console.log('Allowing addresses to be in both basic and upgraded badge lists');
    }
    
    // Add permanent accounts to both lists
    const finalBasicHandles = [...new Set([...filteredBasicHandles, ...PERMANENT_ACCOUNTS])];
    const finalUpgradedHandles = [...new Set([...upgradedHandles, ...PERMANENT_ACCOUNTS])];
    
    // Log permanent accounts
    console.log("\nPermanent accounts added to both lists:", PERMANENT_ACCOUNTS.join(", "));
    console.log(`Basic badge holders ${!excludeBasicForUpgraded ? 'can' : 'cannot'} also have upgraded badges`);
    
    // Return both Twitter handles and wallet addresses (only for addresses with social profiles)
    return {
      basicHolders: finalBasicHandles,
      upgradedHolders: finalUpgradedHandles,
      basicAddresses: basicSocialAddresses,
      upgradedAddresses: upgradedSocialAddresses
    };
  } catch (error) {
    console.error('Error in fetchTokenHolderProfiles:', error);
    return {
      basicHolders: PERMANENT_ACCOUNTS,
      upgradedHolders: PERMANENT_ACCOUNTS,
      basicAddresses: [],
      upgradedAddresses: []
    };
  }
}
