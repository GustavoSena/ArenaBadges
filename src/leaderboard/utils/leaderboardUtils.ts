import * as fs from 'fs';
import * as path from 'path';

import { TokenHolder, NftHolder } from '../../types/interfaces';
import { Leaderboard } from '../../types/leaderboard';
import { fetchArenabookSocial } from '../../api/arenabook';



/**
 * Save the leaderboard to a file
 * @param leaderboard Leaderboard to save
 * @param outputPath Output path
 */
export function saveLeaderboard(leaderboard: Leaderboard, outputPath: string): void {
  try {
    // Ensure the directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save leaderboard to file
    fs.writeFileSync(outputPath, JSON.stringify(leaderboard, null, 2));
    console.log(`Leaderboard saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving leaderboard:', error);
  }
}



/**
 * Helper function to combine token holders based on Twitter handles
 * @param tokenHolders Array of token holders
 * @param walletMapping Mapping of wallet addresses to Twitter handles
 * @returns Combined token holders
 */
export async function combineTokenHoldersByHandle(
  tokenHolders: TokenHolder[],
  walletMapping: Record<string, string>,
  verbose: boolean = false
): Promise<TokenHolder[]> {

  const addressToTwitterHandle: Map<string, string> = new Map<string, string>();
  const combinedAddressesMap: Map<string, string[]> = new Map<string, string[]>();
  // Even if there are no wallet mappings, we still want to combine based on social profiles
  if (Object.keys(walletMapping).length === 0 && verbose) {
    console.log(`No wallet mappings found. Will combine token holders based on social profiles only.`);
  }

  if (verbose) {
    console.log(`\n==== COMBINING TOKEN HOLDERS BY TWITTER HANDLE ====`);
    console.log(`Starting with ${tokenHolders.length} token holders`);
    console.log(`wallet mappings: ${Object.keys(walletMapping).length}`);
      
    if (Object.keys(walletMapping).length === 0) {
      console.log(`No wallet mappings found. Will combine based on social profiles only.`);
    }
  }

  // Map to store Twitter handles to their token data
  const handleToTokenData = new Map<string, {
    handle: string;
    addresses: string[];
    totalBalance: string; // Keep as string to avoid precision issues
    totalBalanceFormatted: number;
    tokenSymbol: string;
  }>();
  
  // Pre-process wallet mapping to ensure case-insensitive lookups
  const normalizedWalletMapping: Record<string, string> = {};
  for (const [address, handle] of Object.entries(walletMapping)) {
    normalizedWalletMapping[address.toLowerCase()] = handle.toLowerCase();
  }

  // Process each token holder
  for (const holder of tokenHolders) {
    const address = holder.address.toLowerCase();
    let twitterHandle = null;

    // Check if we already know the Twitter handle for this address
    if (addressToTwitterHandle.has(address)) {
      twitterHandle = addressToTwitterHandle.get(address)!;
      if (verbose) console.log(`Already know Twitter handle for ${address}: ${twitterHandle}`);
    } else {
      // Check if this address is in the normalized wallet mapping
      const handle = normalizedWalletMapping[address];
      
      if (handle) {
        twitterHandle = handle.toLowerCase();
        addressToTwitterHandle.set(address, twitterHandle);
        if (verbose) console.log(`Found address ${address} in wallet mapping with handle: ${twitterHandle}`);
        
      } else {
        // If not in wallet mapping, check if it has a social profile
        try {
          if (verbose) console.log(`Checking social profile for address: ${address}`);
          const socialProfile = await fetchArenabookSocial(address);
          
          if (socialProfile?.twitter_handle) {
            twitterHandle = socialProfile.twitter_handle.toLowerCase();
            addressToTwitterHandle.set(address, twitterHandle);
            if (verbose) console.log(`Found Twitter handle via social profile: ${address} -> ${twitterHandle}`);
            
          } else {
            if (verbose) console.log(`No Twitter handle found for address: ${address}`);
          }
        } catch (error) {
          if (verbose) console.log(`Error checking social profile for address: ${address}`, error);
          // Ignore errors when checking social profiles
        }
      }
    }

    if (twitterHandle) {
      // We have a Twitter handle for this address
      if (handleToTokenData.has(twitterHandle)) {
        // This handle is already mapped to another wallet, combine token balances
        const data = handleToTokenData.get(twitterHandle)!;
        
        // Add this address to the list if it's not already there
        if (!data.addresses.includes(address)) {
          data.addresses.push(address);
        }

        // Add the token balance (as string to avoid precision issues)
        const currentBalance = BigInt(data.totalBalance);
        const additionalBalance = BigInt(holder.balance);
        data.totalBalance = (currentBalance + additionalBalance).toString();

        // Update the formatted balance
        data.totalBalanceFormatted += holder.balanceFormatted;
        
        // Update the map
        handleToTokenData.set(twitterHandle, data);
      } else {
        // This is the first time we're seeing this handle
        handleToTokenData.set(twitterHandle, {
          handle: twitterHandle,
          addresses: [address],
          totalBalance: holder.balance,
          totalBalanceFormatted: holder.balanceFormatted,
          tokenSymbol: holder.tokenSymbol
        });
        
      }
    }
  }

  // Create combined token holders list
  const combinedHolders: TokenHolder[] = [];

  // Add combined holders by Twitter handle
  for (const [handle, data] of handleToTokenData.entries()) {
    if (data.addresses.length > 0) {
      // Find an address from the wallet mapping file, if any
      let representativeAddress = data.addresses[0]; // Default to first address
      
      // Check if any of the addresses are in the wallet mapping
      for (const address of data.addresses) {
        if (normalizedWalletMapping[address.toLowerCase()]) {
          // Prioritize addresses from the wallet mapping file
          representativeAddress = address;
          if (verbose) console.log(`Using address from wallet mapping as representative for handle ${handle}: ${address}`);
          break;
        }
      }

      // Create the combined holder
      const combinedHolder: TokenHolder = {
        address: representativeAddress,
        balance: data.totalBalance,
        balanceFormatted: data.totalBalanceFormatted,
        tokenSymbol: data.tokenSymbol
      };

      // Add the combined holder to the list
      combinedHolders.push(combinedHolder);

      // Store combined addresses information if there are multiple addresses
      if (data.addresses.length > 1) {
        combinedAddressesMap.set(representativeAddress.toLowerCase(), data.addresses);
      }

      // Debug: Log the combined holder
      if (verbose) console.log(`Combined ${data.addresses.length} wallets for handle ${handle} with total token balance: ${data.totalBalanceFormatted} ${data.tokenSymbol}`);
    }
  }

  // Add individual holders that weren't combined
  for (const holder of tokenHolders) {
    const address = holder.address.toLowerCase();
    if (!addressToTwitterHandle.has(address)) {
      combinedHolders.push(holder);
    }
  }

  if (verbose) console.log(`After combining, found ${combinedHolders.length} token holders (reduced from ${tokenHolders.length})`);
  return combinedHolders;
}

/**
 * Helper function to combine NFT holders based on Twitter handles
 * This is used when sumOfBalances is enabled to aggregate NFT counts for the same Twitter handle
 * @param nftHolders Array of NFT holders
 * @param walletMapping Mapping of wallet addresses to Twitter handles
 * @param handleToWallet Mapping of Twitter handles to wallet addresses
 * @param minBalance Minimum balance required
 * @param sumOfBalances Whether to sum balances for the same Twitter handle
 * @param twitterHandleMap Map of addresses to Twitter handles
 * @param combinedAddressesMap Map of representative addresses to all combined addresses
 * @returns Combined NFT holders
 */
export async function combineNftHoldersByHandle(
  nftHolders: NftHolder[],
  walletMapping: Record<string, string>,
  handleToWallet: Record<string, string>,
  minBalance: number,
  sumOfBalances: boolean,
  addressToTwitterHandle: Map<string, string> = new Map<string, string>(),
  combinedAddressesMap: Map<string, string[]> = new Map<string, string[]>(),
  verbose: boolean = false
): Promise<NftHolder[]> {
  if (!sumOfBalances) {
    if (verbose) console.log(`NFT wallet mapping skipped: sumOfBalances=${sumOfBalances}`);
    return nftHolders; // Return original holders if feature is disabled
  }
  
  // Even if there are no wallet mappings, we still want to combine based on social profiles
  if (Object.keys(walletMapping).length === 0 && verbose) {
    console.log(`No wallet mappings found. Will combine NFT holders based on social profiles only.`);
  }
  
  if (verbose) {
    console.log(`Combining NFT holders by Twitter handle (${nftHolders.length} holders)...`);
    
    // Debug: Print the first few NFT holders
    console.log('First few NFT holders:');
    nftHolders.slice(0, 5).forEach(holder => {
      console.log(`  ${holder.address} (${holder.tokenCount} ${holder.tokenName})`);
    });
  }
  
  // Map to store combined token counts by Twitter handle
  const handleToNfts: Record<string, {
    addresses: string[];
    totalCount: number;
    tokenName: string;
  }> = {};
  
  // Map to store addresses that have been processed
  const processedAddresses = new Set<string>();
  
  // First pass: Process addresses with wallet mappings
  for (const holder of nftHolders) {
    const address = holder.address.toLowerCase();
    const handle = walletMapping[address];
    
    if (handle) {
      // This address has a wallet mapping
      if (!handleToNfts[handle]) {
        // Initialize entry for this handle
        handleToNfts[handle] = {
          addresses: [address],
          totalCount: holder.tokenCount,
          tokenName: holder.tokenName
        };
      } else {
        // Add this address's NFT count to the existing handle
        handleToNfts[handle].addresses.push(address);
        handleToNfts[handle].totalCount += holder.tokenCount;
      }
      
      processedAddresses.add(address);
    }
  }
  
  // Second pass: Process addresses without wallet mappings
  for (const holder of nftHolders) {
    const address = holder.address.toLowerCase();
    
    if (!processedAddresses.has(address)) {
      // This address doesn't have a mapping, check if it has a social profile
      try {
        const socialProfile = await fetchArenabookSocial(address);
        
        if (socialProfile?.twitter_handle) {
          const handle = socialProfile.twitter_handle;
          
          // Check if this handle already has a mapping
          if (handleToWallet[handle]) {
            // This handle is already mapped to another wallet, combine NFT counts
            if (!handleToNfts[handle]) {
              // Initialize entry for this handle (shouldn't happen, but just in case)
              handleToNfts[handle] = {
                addresses: [address],
                totalCount: holder.tokenCount,
                tokenName: holder.tokenName
              };
            } else {
              // Add this address's NFT count to the existing handle
              handleToNfts[handle].addresses.push(address);
              handleToNfts[handle].totalCount += holder.tokenCount;
            }
            
            processedAddresses.add(address);
          } else {
            // This handle is not mapped to any wallet yet, create a new entry
            handleToNfts[handle] = {
              addresses: [address],
              totalCount: holder.tokenCount,
              tokenName: holder.tokenName
            };
            
            processedAddresses.add(address);
          }
        } else {
          // No Twitter handle found, keep as individual holder
          // (will be added in the final step)
        }
      } catch (error) {
        if (verbose) console.error(`Error fetching social profile for ${address}:`, error);
        // Keep as individual holder (will be added in the final step)
      }
    }
  }
  
  // Create combined NFT holders list
  const combinedHolders: NftHolder[] = [];
  
  // Add combined holders by Twitter handle
  for (const [handle, data] of Object.entries(handleToNfts)) {
    if (data.totalCount >= minBalance) {
      // Use the first address as the representative address
      const representativeAddress = data.addresses[0];
      
      // Create the combined holder without the twitterHandle property
      const combinedHolder: NftHolder = {
        address: representativeAddress,
        tokenCount: data.totalCount,
        tokenName: data.tokenName
      };
      
      // Add the combined holder to the list
      combinedHolders.push(combinedHolder);
      
      // Store the Twitter handle in a map to use later when processing social profiles
      // We'll use this in the calculateHolderPoints function
      if (!addressToTwitterHandle.has(representativeAddress.toLowerCase())) {
        addressToTwitterHandle.set(representativeAddress.toLowerCase(), handle);
      }
      
      // Store combined addresses information if there are multiple addresses
      if (data.addresses.length > 1) {
        combinedAddressesMap.set(representativeAddress.toLowerCase(), data.addresses);
      }
      
      // Debug: Log the combined holder
      if (verbose) console.log(`Combined ${data.addresses.length} wallets for handle ${handle} with total NFT count: ${data.totalCount}`);
    }
  }
  
  // Add individual holders that weren't combined
  for (const holder of nftHolders) {
    const address = holder.address.toLowerCase();
    
    if (!processedAddresses.has(address) && holder.tokenCount >= minBalance) {
      combinedHolders.push(holder);
    }
  }
  
  if (verbose) console.log(`After combining, found ${combinedHolders.length} NFT holders (reduced from ${nftHolders.length})`);
  return combinedHolders;
}
