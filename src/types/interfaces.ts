export interface Holding{
  tokenAddress: string;
  tokenSymbol: string;
  tokenBalance: string;
}

export interface NftHolding extends Holding{
}

export interface TokenHolding extends Holding{
  tokenDecimals: number;
  balanceFormatted: number;
}

// Token holder interfaces
export interface TokenHolder {
  address: string;
  holding: TokenHolding;
}

export interface NftHolder {
  address: string;
  holding: NftHolding;
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

export interface ArenaWalletResponse {
  address: string;
  picture_url: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {               // the data expected from .select()
          id: number
          twitter_handle: string
          twitter_image_url: string
          wallet: string
          updated_at: string
        }
      }
    }
  }
}