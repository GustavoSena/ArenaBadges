import { BaseLeaderboard, LeaderboardConfig } from '../../types/leaderboard';
import { LeaderboardTokenConfig, LeaderboardNftConfig, HolderPoints } from '../../types/leaderboard';
import { TokenHolding, NftHolding } from '../../types/interfaces';
import { ethers } from 'ethers';
import { formatTokenBalance } from '../../utils/helpers';

/**
 * Standard leaderboard implementation
 */
export class StandardLeaderboard extends BaseLeaderboard {
  constructor(provider: ethers.JsonRpcProvider, leaderboardConfig: LeaderboardConfig) {
    super(provider, leaderboardConfig);
  }

  public getLeaderboardTokens(): LeaderboardTokenConfig[] {
    return this.leaderboardConfig.weights.tokens;
  }

  public getLeaderboardNFTs(): LeaderboardNftConfig[] {
    return this.leaderboardConfig.weights.nfts;
  }

  public getSumOfBalances(): boolean {
    return this.leaderboardConfig.sumOfBalances;
  }
  
  /**
   * Calculate points for a holder based on their token and NFT holdings
   * @param tokenHoldings The token holdings for the holder
   * @param nftHoldings The NFT holdings for the holder
   * @returns The calculated points
   */
  async calculatePoints(tokenHoldings: TokenHolding[], nftHoldings: NftHolding[]): Promise<HolderPoints> {
    let holderPoints: HolderPoints = {
      totalPoints: 0,
      tokenPoints: {},
      nftPoints: {}
    };
    
    
    // Calculate token points
    for (const holding of tokenHoldings) {
      const token = this.leaderboardConfig.weights.tokens.find((t: LeaderboardTokenConfig) => t.symbol === holding.tokenSymbol);
      if (token) {
        holderPoints.tokenPoints[holding.tokenSymbol] = formatTokenBalance(holding.tokenBalance, holding.tokenDecimals) * token.weight;
        holderPoints.totalPoints += holderPoints.tokenPoints[holding.tokenSymbol];
      }
    }
    
    // Calculate NFT points
    for (const holding of nftHoldings) {
      const nft = this.leaderboardConfig.weights.nfts.find((n: LeaderboardNftConfig) => n.name === holding.tokenSymbol);
      if (nft) {
        holderPoints.nftPoints[holding.tokenSymbol] = +holding.tokenBalance * nft.weight;
        holderPoints.totalPoints += holderPoints.nftPoints[holding.tokenSymbol];
      }
    }
    
    return holderPoints;
  }
  
  /**
   * Check if a holder meets the minimum balance requirements
   * @param tokenHoldings The token holdings for the holder
   * @param nftHoldings The NFT holdings for the holder
   * @returns Whether the holder meets the minimum balance requirements
   */
  async checkEligibility(tokenHoldings: TokenHolding[], nftHoldings: NftHolding[]): Promise<boolean> {
    
    // Check token eligibility
    for (const holding of tokenHoldings) {
      const token = this.leaderboardConfig.weights.tokens.find((t: LeaderboardTokenConfig) => t.symbol === holding.tokenSymbol);
      if (token && formatTokenBalance(holding.tokenBalance, holding.tokenDecimals) >= token.minBalance) {
        return true;
      }
    }
    
    // Check NFT eligibility
    for (const holding of nftHoldings) {
      const nft = this.leaderboardConfig.weights.nfts.find((n: LeaderboardNftConfig) => n.name === holding.tokenSymbol);
      if (nft && +holding.tokenBalance >= nft.minBalance) {
        return true;
      }
    }
    
    return false;
  }
    /**
   * Calculate dynamic minimum balance for a token based 
   * @param tokenSymbol The token symbol
   * @returns The calculated minimum balance
   */
    public async calculateDynamicMinimumBalance(tokenSymbol?: string): Promise<number> {
      return 100;
    }
  /**
   * Get the output file name for this leaderboard
   * @returns The output file name
   */
  getOutputFileName(): string {
    return "standard_leaderboard.json";
  }
}
