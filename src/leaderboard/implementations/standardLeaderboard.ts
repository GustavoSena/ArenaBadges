import { BaseLeaderboard } from '../../types/leaderboard';
import { LeaderboardTokenConfig, LeaderboardNftConfig } from '../../types/leaderboard';
import { TokenHolder, NftHolder } from '../../types/interfaces';
import { ethers } from 'ethers';

/**
 * Standard leaderboard implementation
 */
export class StandardLeaderboard extends BaseLeaderboard {
  constructor(provider: ethers.JsonRpcProvider, excludedAccounts: string[]) {
    super(provider, excludedAccounts);
  }
  
  /**
   * Calculate points for a holder based on their token and NFT holdings
   * @param tokenHoldings The token holdings for the holder
   * @param nftHoldings The NFT holdings for the holder
   * @returns The calculated points
   */
  async calculatePoints(tokenHoldings: TokenHolder[], nftHoldings: NftHolder[], tokens: LeaderboardTokenConfig[], nfts: LeaderboardNftConfig[]): Promise<number> {
    let totalPoints = 0;
    
    // Calculate token points
    for (const holding of tokenHoldings) {
      const token = tokens.find((t: LeaderboardTokenConfig) => t.symbol === holding.tokenSymbol);
      if (token) {
        totalPoints += holding.balanceFormatted * token.weight;
      }
    }
    
    // Calculate NFT points
    for (const holding of nftHoldings) {
      const nft = nfts.find((n: LeaderboardNftConfig) => n.name === holding.tokenName);
      if (nft) {
        totalPoints += holding.tokenCount * nft.weight;
      }
    }
    
    return totalPoints;
  }
  
  /**
   * Check if a holder meets the minimum balance requirements
   * @param tokenHoldings The token holdings for the holder
   * @param nftHoldings The NFT holdings for the holder
   * @returns Whether the holder meets the minimum balance requirements
   */
  async checkEligibility(tokenHoldings: TokenHolder[], nftHoldings: NftHolder[], tokens: LeaderboardTokenConfig[], nfts: LeaderboardNftConfig[]): Promise<boolean> {
    
    // Check token eligibility
    for (const holding of tokenHoldings) {
      const token = tokens.find((t: LeaderboardTokenConfig) => t.symbol === holding.tokenSymbol);
      if (token && holding.balanceFormatted >= token.minBalance) {
        return true;
      }
    }
    
    // Check NFT eligibility
    for (const holding of nftHoldings) {
      const nft = nfts.find((n: LeaderboardNftConfig) => n.name === holding.tokenName);
      if (nft && holding.tokenCount >= nft.minBalance) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get the output file name for this leaderboard
   * @returns The output file name
   */
  getOutputFileName(): string {
    return "standard_leaderboard.json";
  }
}
