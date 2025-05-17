import { TokenHolder, NftHolder } from './interfaces';
import { Leaderboard, LeaderboardEntry, HolderPoints, LeaderboardConfig } from './leaderboard';
import { ethers } from 'ethers';

/**
 * Interface for excluded accounts configuration
 */
export interface ExcludedAccountsConfig {
  excludedAccounts: string[];
}

/**
 * Interface for price provider contract
 */
export interface PriceProvider {
  /**
   * Retrieves the MUG/MU price from the contract
   * @returns Promise resolving to the MUG/MU price
   */
  getMugMuPrice(): Promise<number>;
}

/**
 * Base leaderboard class with common functionality
 */
export abstract class BaseLeaderboard {
  protected provider: ethers.JsonRpcProvider;
  protected excludedAccounts: string[] = [];
  
  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.loadExcludedAccounts();
  }
  
  /**
   * Load excluded accounts from leaderboard configuration
   */
  protected loadExcludedAccounts(): void {
    try {
      // Get excluded accounts from the leaderboard configuration
      const config = this.loadConfig();
      if (config && config.excludedAccounts && Array.isArray(config.excludedAccounts)) {
        this.excludedAccounts = config.excludedAccounts.map((account: string) => account.toLowerCase());
        console.log(`Loaded ${this.excludedAccounts.length} excluded accounts from leaderboard config`);
      } else {
        console.log('No excluded accounts found in leaderboard config, using empty list');
        this.excludedAccounts = [];
      }
    } catch (error) {
      console.error('Error loading excluded accounts:', error);
      this.excludedAccounts = [];
    }
  }
  
  /**
   * Calculate points for each token and NFT holding
   * @param tokenHoldings Token holdings for a holder
   * @param nftHoldings NFT holdings for a holder
   */
  abstract calculatePoints(
    tokenHoldings: TokenHolder[],
    nftHoldings: NftHolder[]
  ): Promise<number>;
  
  /**
   * Check if a holder meets the minimum balance requirements
   * @param tokenHoldings Token holdings for a holder
   * @param nftHoldings NFT holdings for a holder
   */
  abstract checkEligibility(
    tokenHoldings: TokenHolder[],
    nftHoldings: NftHolder[]
  ): Promise<boolean>;
  
  /**
   * Load the leaderboard configuration
   */
  abstract loadConfig(): LeaderboardConfig;
  
  /**
   * Get the output file name
   */
  abstract getOutputFileName(): string;
  
  /**
   * Generate a leaderboard from holder points
   * @param holderPoints Holder points
   * @param maxEntries Maximum number of entries to include (0 for all)
   */
  generateLeaderboard(holderPoints: HolderPoints[], maxEntries: number = 0): Leaderboard {
    try {
      // Filter out excluded accounts
      const filteredHolders = holderPoints.filter(holder => {
        if (holder.twitterHandle && this.excludedAccounts.includes(holder.twitterHandle.toLowerCase())) {
          console.log(`Excluding account from leaderboard: ${holder.twitterHandle}`);
          return false;
        }
        return true;
      });
      
      // Sort holders by total points (descending)
      const sortedHolders = filteredHolders.sort((a, b) => b.totalPoints - a.totalPoints);
      
      // Generate leaderboard entries with rankings
      // If maxEntries is 0, include all entries
      const entriesToInclude = maxEntries === 0 ? sortedHolders.length : maxEntries;
      const entries: LeaderboardEntry[] = sortedHolders.slice(0, entriesToInclude).map((holder, index) => ({
        rank: index + 1,
        twitterHandle: holder.twitterHandle as string, // We already filtered for non-null handles
        profileImageUrl: holder.profileImageUrl,
        address: holder.address,
        totalPoints: holder.totalPoints,
        tokenPoints: holder.tokenPoints,
        nftPoints: holder.nftPoints
      }));
      
      // Create the leaderboard
      const leaderboard: Leaderboard = {
        timestamp: new Date().toISOString(),
        entries
      };
      
      return leaderboard;
    } catch (error) {
      console.error('Error generating leaderboard:', error);
      throw error;
    }
  }
}
