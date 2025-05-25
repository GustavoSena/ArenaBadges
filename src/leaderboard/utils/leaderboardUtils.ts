import * as fs from 'fs';
import * as path from 'path';

import { Leaderboard, BaseLeaderboard, HolderEntry, LeaderboardTokenConfig, LeaderboardNftConfig } from '../../types/leaderboard';
import { TokenConfig, TokenHolding, NftHolding } from '../../types/interfaces';
import { updateTokenHoldingsMap, processTokenBalances } from '../../utils/tokenUtils';



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
    throw error;
  }
}

/**
 * Process wallet holdings and check eligibility for leaderboard
 * @param handle Twitter handle
 * @param addressRecord Record of addresses associated with the handle
 * @param walletToTokenHoldings Map of wallet addresses to token holdings
 * @param walletToNftHoldings Map of wallet addresses to NFT holdings
 * @param leaderboardTokens Array of token configs for the leaderboard
 * @param leaderboardNfts Array of NFT configs for the leaderboard
 * @param leaderboard Leaderboard implementation
 * @param sumOfBalances Whether to sum balances across wallets
 * @param verbose Whether to log verbose output
 * @returns Holder entry if eligible, null otherwise
 */
export async function processWalletHoldings(
  handle: string,
  addressRecord: Record<string, string>,
  walletToTokenHoldings: Map<string, Map<string, TokenHolding>>,
  walletToNftHoldings: Map<string, Map<string, NftHolding>>,
  leaderboardTokens: LeaderboardTokenConfig[],
  leaderboardNfts: LeaderboardNftConfig[],
  leaderboard: BaseLeaderboard,
  sumOfBalances: boolean,
  verbose: boolean
): Promise<HolderEntry | null> {
  const addressesToUse = Object.keys(addressRecord);
  // Skip if no address holdings
  if (addressesToUse.length === 0) return null;
    
  let tokenHoldingsMap: {[key:string]:TokenHolding} = {};
  const nftHoldingsMap: {[key:string]:NftHolding} = {};

  // Process each address
  for (const address of addressesToUse) {
    if (verbose) console.log(`Processing address ${address} for Twitter handle ${handle}`);
    
    // Process token holdings with batch processing
    const missingTokens: TokenConfig[] = [];
    
    // First process tokens that we already have holdings for
    for (const tokenConfig of leaderboardTokens) {
      const symbol = tokenConfig.symbol;
      
      if (walletToTokenHoldings.has(address) && walletToTokenHoldings.get(address)!.has(symbol)) {
        const holding = walletToTokenHoldings.get(address)!.get(symbol)!;
        tokenHoldingsMap = updateTokenHoldingsMap(tokenHoldingsMap, symbol, holding, sumOfBalances, verbose, address);
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
    
    // Process NFT holdings
    if (walletToNftHoldings.has(address)) {
      const nftHoldings = walletToNftHoldings.get(address)!;
      for (const [name, holding] of nftHoldings.entries()) {
        if (nftHoldingsMap[name]) {
          if (sumOfBalances) {
            nftHoldingsMap[name].tokenBalance = (+nftHoldingsMap[name].tokenBalance! + +holding.tokenBalance!).toString();
          } else {
            if (holding.tokenBalance! > nftHoldingsMap[name].tokenBalance!) {
              nftHoldingsMap[name] = holding;
            }
          }
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
    profileImageUrl: null, // Will be set later
    points: holderPoints,
  };
}

