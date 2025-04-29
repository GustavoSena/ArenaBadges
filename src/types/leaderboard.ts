import { TokenHolder, NftHolder } from './interfaces';

export interface LeaderboardConfig {
  weights: {
    tokens: TokenWeight[];
    nfts: NftWeight[];
  };
  output: {
    maxEntries: number;
    filename: string;
  };
}

export interface TokenWeight {
  symbol: string;
  address: string;
  pointsPerToken: number;
  minBalance: number;
}

export interface NftWeight {
  name: string;
  address: string;
  pointsPerNft: number;
  minBalance: number;
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
