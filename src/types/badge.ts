import { TokenConfig, NftConfig } from "./interfaces";

/**
 * Badge requirement configuration
 */
export interface BadgeRequirement {
  /** Token requirements for this badge tier */
  tokens?: TokenConfig[];
  /** NFT requirements for this badge tier */
  nfts?: NftConfig[];
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
    upgraded?: BadgeRequirement;
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