export interface LeaderboardTokenConfig {
  /** Token symbol */
  symbol: string;
  /** Weight multiplier for points calculation */
  weight: number;
  /** Minimum balance required to earn points */
  minBalance: number;
  /** Token contract address */
  address: string;
  /** Token decimals */
  decimals: number;
  /** Description of the token's role in the leaderboard */
  description?: string;
}

export interface LeaderboardNftConfig {
  /** NFT collection name */
  name: string;
  /** Weight multiplier for points calculation */
  weight: number;
  /** Points awarded per NFT held */
  pointsPerToken: number;
  /** Minimum number of NFTs required to earn points */
  minBalance: number;
  /** NFT contract address */
  address: string;
  /** Collection size */
  collectionSize?: number;
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

export interface HolderPoints {
  address: string;
  twitterHandle: string | null;
  profileImageUrl: string | null;
  totalPoints: number;
  tokenPoints: {
    [symbol: string]: number;
  };
  nftPoints: {
    [name: string]: number;
  };
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