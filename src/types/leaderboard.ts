import { NftConfig, NftHolding, TokenConfig, TokenHolding } from "./interfaces";
import { ethers } from 'ethers';

export interface LeaderboardTokenConfig extends TokenConfig {
  /** Weight multiplier for points calculation */
  weight: number;
  /** Description of the token's role in the leaderboard */
  description?: string;
}

export interface LeaderboardNftConfig extends NftConfig{
  /** Weight multiplier for points calculation */
  weight: number;
  /** Points awarded per NFT held */
  pointsPerToken: number;
}

export interface LeaderboardColumn {
  /** Display name of the column */
  name: string;
  /** Data field to display in this column */
  field: string;
  /** Width of the column (CSS value) */
  width: string;
}

/**
 * Output configuration for leaderboard HTML generation
 */ 
export interface LeaderboardOutput {
  /** Title displayed on the leaderboard */
  title: string;
  /** Path to the logo image */
  logoPath: string;
  /** File name for the leaderboard HTML */
  fileName?: string;
  /** Maximum number of entries to display */
  maxEntries: number;
  /** Text describing the refresh schedule */
  refreshTimeLabel: string;
  /** Primary color for styling */
  primaryColor: string;
  /** Secondary color for styling */
  secondaryColor: string;
  /** Accent color for styling */
  accentColor: string;
  /** Background color for styling */
  backgroundColor: string;
  /** Gradient start color for styling */
  gradientStart: string;
  /** Gradient end color for styling */
  gradientEnd: string;
  /** Color for Twitter handle text */
  twitterColor: string;
  /** Color for wallet address text */
  addressColor: string;
  /** Column definitions for the leaderboard table */
  columns: LeaderboardColumn[];
}

export interface LeaderboardConfig {
  /** Title of the leaderboard */
  title: string;
  /** Scoring weights configuration */
  weights: {
    /** Token weight configurations */
    tokens: LeaderboardTokenConfig[];
    /** NFT weight configurations */
    nfts: LeaderboardNftConfig[];
  };
  /** Output formatting configuration */
  output: LeaderboardOutput;
  /** Twitter handles to exclude from the leaderboard */
  excludedAccounts: string[];
  /** Whether to sum balances across wallets belonging to the same user */
  sumOfBalances: boolean;
}

export interface HolderPoints{
  totalPoints: number;
  tokenPoints: {
    [symbol: string]: number;
  };
  nftPoints: {
    [name: string]: number;
  };
}

export interface HolderEntry {
  address: string;
  twitterHandle: string | null;
  profileImageUrl: string | null;
  points: HolderPoints;
}

export interface LeaderboardEntry {
  rank: number;
  twitterHandle: string;
  profileImageUrl: string | null;
  address: string;
  totalPoints: number;
  tokenPoints: {
    [symbol: string]: number;
  };
  nftPoints: {
    [name: string]: number;
  };
}

export interface Leaderboard {
  timestamp: string;
  entries: LeaderboardEntry[];
}


/**
 * Base leaderboard class with common functionality
 */
export abstract class BaseLeaderboard {
  protected provider: ethers.JsonRpcProvider;
  protected excludedAccounts: string[] = [];
  
  constructor(provider: ethers.JsonRpcProvider, excludedAccounts: string[]) {
    this.provider = provider;
    this.excludedAccounts = excludedAccounts;
  }
  
  /**
   * Calculate points for each token and NFT holding
   * @param tokenHoldings Token holdings for a holder
   * @param nftHoldings NFT holdings for a holder
   */
  abstract calculatePoints(
    tokenHoldings: TokenHolding[],
    nftHoldings: NftHolding[],
    tokens: LeaderboardTokenConfig[],
    nfts: LeaderboardNftConfig[],
    verbose?: boolean
  ): Promise<HolderPoints>;
  
  /**
   * Check if a holder meets the minimum balance requirements
   * @param tokenHoldings Token holdings for a holder
   * @param nftHoldings NFT holdings for a holder
   */
  abstract checkEligibility(
    tokenHoldings: TokenHolding[],
    nftHoldings: NftHolding[],
    tokens: LeaderboardTokenConfig[],
    nfts: LeaderboardNftConfig[],
    verbose?: boolean
  ): Promise<boolean>;
  
  /**
   * Get the output file name
   */
  abstract getOutputFileName(): string;
  /**
   * Calculate dynamic minimum balance
   * @param tokenSymbol The token symbol
   * @returns The calculated minimum balance
   */
  abstract calculateDynamicMinimumBalance(tokenSymbol?: string): Promise<number>;
  /**
   * Generate a leaderboard from holder points
   * @param holderPoints Holder points
   * @param maxEntries Maximum number of entries to include (0 for all)
   */
  generateLeaderboard(holderPoints: HolderEntry[], maxEntries: number = 0): Leaderboard {
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
      const sortedHolders = filteredHolders.sort((a, b) => b.points.totalPoints - a.points.totalPoints);
      
      // Generate leaderboard entries with rankings
      // If maxEntries is 0, include all entries
      const entriesToInclude = maxEntries === 0 ? sortedHolders.length : maxEntries;
      const entries: LeaderboardEntry[] = sortedHolders.slice(0, entriesToInclude).map((holder, index) => ({
        rank: index + 1,
        twitterHandle: holder.twitterHandle as string, // We already filtered for non-null handles
        profileImageUrl: holder.profileImageUrl,
        address: holder.address,
        totalPoints: holder.points.totalPoints,
        tokenPoints: holder.points.tokenPoints,
        nftPoints: holder.points.nftPoints
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
