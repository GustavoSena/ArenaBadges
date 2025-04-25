// Token holder interfaces
export interface TokenHolder {
  address: string;
  balance: string;
  balanceFormatted: number;
  tokenSymbol: string;
}

export interface NftHolder {
  address: string;
  tokenCount: number;
  tokenName: string;
}

// Social profile interfaces
export interface ArenabookUserResponse {
  twitter_username: string | null;
  twitter_handle: string | null;
}

export interface HolderWithSocial extends TokenHolder {
  twitter_handle: string | null;
}

export interface NftHolderWithSocial extends NftHolder {
  twitter_handle: string | null;
}

// Config interfaces
export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  minBalance: number;
}

export interface NftConfig {
  address: string;
  name: string;
  minBalance: number;
}

export interface AppConfig {
  tokens: TokenConfig[];
  nfts: NftConfig[];
}

// Output interfaces
export interface TwitterHandlesOutput {
  handles: string[];
}
