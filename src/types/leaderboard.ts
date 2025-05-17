export interface LeaderboardConfig {
  weights: {
    tokens: TokenWeight[];
    nfts: NftWeight[];
  };
  output: LeaderboardOutput;
  excludedAccounts?: string[];
  title?: string;
  description?: string;
  sumOfBalances?: boolean;
  walletMappingFile?: string;
}

export interface TokenWeight {
  symbol: string;
  address: string;
  pointsPerToken: number;
  minBalance: number;
  decimals?: number; // Optional decimal places for the token
}

export interface NftWeight {
  name: string;
  address: string;
  minBalance: number;
  pointsPerToken: number;
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

export interface LeaderboardOutput {
  maxEntries: number;
  fileName: string;
  title: string;
  logoPath?: string;
  titleLink?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
}
