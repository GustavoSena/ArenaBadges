import * as path from 'path';
import * as fs from 'fs';
import { BaseLeaderboard } from '../../types/leaderboardClasses';
import { LeaderboardConfig } from '../../types/leaderboard';
import { TokenHolder, NftHolder } from '../../types/interfaces';
import { ethers } from 'ethers';

/**
 * Standard leaderboard implementation
 */
export class StandardLeaderboard extends BaseLeaderboard {
  constructor(provider: ethers.JsonRpcProvider) {
    super(provider);
  }
  
  /**
   * Calculate points for a holder based on their token and NFT holdings
   * @param tokenHoldings The token holdings for the holder
   * @param nftHoldings The NFT holdings for the holder
   * @returns The calculated points
   */
  async calculatePoints(tokenHoldings: TokenHolder[], nftHoldings: NftHolder[]): Promise<number> {
    const config = this.loadConfig();
    let totalPoints = 0;
    
    // Calculate token points
    for (const holding of tokenHoldings) {
      const tokenWeight = config.weights.tokens.find(t => t.symbol === holding.tokenSymbol);
      if (tokenWeight) {
        totalPoints += holding.balanceFormatted * tokenWeight.pointsPerToken;
      }
    }
    
    // Calculate NFT points
    for (const holding of nftHoldings) {
      const nftWeight = config.weights.nfts.find(n => n.name === holding.tokenName);
      if (nftWeight) {
        totalPoints += holding.tokenCount * nftWeight.pointsPerToken;
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
  async checkEligibility(tokenHoldings: TokenHolder[], nftHoldings: NftHolder[]): Promise<boolean> {
    const config = this.loadConfig();
    
    // Check token eligibility
    for (const holding of tokenHoldings) {
      const tokenWeight = config.weights.tokens.find(t => t.symbol === holding.tokenSymbol);
      if (tokenWeight && holding.balanceFormatted >= tokenWeight.minBalance) {
        return true;
      }
    }
    
    // Check NFT eligibility
    for (const holding of nftHoldings) {
      const nftWeight = config.weights.nfts.find(n => n.name === holding.tokenName);
      if (nftWeight && holding.tokenCount >= nftWeight.minBalance) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Load the leaderboard configuration
   * @returns The leaderboard configuration
   */
  loadConfig(): LeaderboardConfig {
    try {
      const configPath = path.join(__dirname, '../../../config/leaderboard.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData) as LeaderboardConfig;
    } catch (error) {
      console.error('Error loading leaderboard config:', error);
      throw new Error('Failed to load leaderboard configuration');
    }
  }
  
  /**
   * Get the output file name for this leaderboard
   * @returns The output file name
   */
  getOutputFileName(): string {
    const config = this.loadConfig();
    return config.output.fileName;
  }
}
