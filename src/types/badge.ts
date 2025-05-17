
/**
 * Token configuration for badge requirements
 */
export interface BadgeTokenConfig {
  symbol: string;
  /** Token contract address */
  address: string;
  /** Minimum balance required for badge qualification */
  minBalance: number;
  /** Token decimals (typically 18 for most ERC20 tokens) */
  decimals: number;
}

/**
 * NFT configuration for badge requirements
 */
export interface BadgeNftConfig {
  /** NFT collection name */
  name: string;
  /** NFT contract address */
  address: string;
  /** Size of the NFT collection (maximum token ID) */
  collectionSize?: number;
  /** Minimum number of NFTs required for badge qualification */
  minBalance: number;
}

/**
 * Badge requirement configuration
 */
export interface BadgeRequirement {
  /** Token requirements for this badge tier */
  tokens?: BadgeTokenConfig[];
  /** NFT requirements for this badge tier */
  nfts?: BadgeNftConfig[];
}

export interface BadgeConfig {
  /** Display name of the badge */
  name: string;
  /** Project identifier */
  projectName: string;
  /** Badge tier requirements */
  badges: {
    /** Basic tier requirements */
    basic: BadgeRequirement;
    /** Upgraded tier requirements (optional) */
    upgraded: BadgeRequirement;
  };
  /** Twitter handles that should be excluded from badge lists */
  excludedAccounts: string[];
  /** Twitter handles that should always be included in badge lists */
  permanentAccounts: string[];
  /** API configuration for sending badge data */
  api: BadgeApiConfig;
  /** Whether users with upgraded badges should be excluded from basic badge list */
  excludeBasicForUpgraded: boolean;
  /** Whether to sum balances across wallets belonging to the same user */
  sumOfBalances: boolean;
}



export interface BadgeApiConfig {
  baseUrl: string;
  endpoints: {
    basic: string;
    upgraded: string;
  };
}