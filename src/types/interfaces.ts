export interface Holding{
  tokenAddress: string;
  tokenSymbol: string;
  tokenBalance: string;
}

export interface NftHolding extends Holding{
}

export interface TokenHolding extends Holding{
  tokenDecimals: number;
}

export interface AddressHoldings{
  address: string;
  nftHoldings: { [key: string]: NftHolding };
  tokenHoldings: { [key: string]: TokenHolding };
  fromMapping: boolean;
}

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
  twitter_handle: string | null;  
  twitter_pfp_url: string | null;
}

// Stars Arena API response interface
export interface StarsArenaUserResponse {
  user: {
    id: string;
    twitterHandle: string;
    twitterPicture: string;
  };
}

export interface HolderWithSocial extends TokenHolder {
  twitter_handle: string | null;
  twitter_pfp_url?: string | null;
}

export interface NftHolderWithSocial extends NftHolder {
  twitter_handle: string | null;
  twitter_pfp_url?: string | null;
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
  /** Size of the NFT collection (maximum token ID) */
  collectionSize?: number;
}
