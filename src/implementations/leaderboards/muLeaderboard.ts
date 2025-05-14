import * as fs from 'fs';
import * as path from 'path';
import { loadLeaderboardConfig } from '../../utils/config';
import { BaseLeaderboard } from '../../types/leaderboardClasses';
import { LeaderboardConfig } from '../../types/leaderboard';
import { TokenHolder, NftHolder } from '../../types/interfaces';
import { ethers } from 'ethers';

/**
 * MU leaderboard implementation with MU-specific point calculation logic
 */
export class MuLeaderboard extends BaseLeaderboard {
  private priceProviderContract: ethers.Contract;
  private mugMuPrice: number = 0;
  
  /**
   * Constructor for the MU leaderboard
   * @param provider The ethers provider for blockchain interactions
   */
  constructor(provider: ethers.JsonRpcProvider) {
    super(provider);
    
    // ABI for the price provider contract
    const priceProviderAbi = [
      "function getMugMuPrice() view returns (uint256)"
    ];
    
    // Initialize the price provider contract
    this.priceProviderContract = new ethers.Contract(
      "0x06bC5F1C59a971cDff30431B100ae69f416115a2", 
      priceProviderAbi, 
      provider
    );
  }
  
  /**
   * Calculate points for a holder
   * @param tokenHoldings Token holdings
   * @param nftHoldings NFT holdings
   * @returns Total points
   */
  async calculatePoints(tokenHoldings: TokenHolder[], nftHoldings: NftHolder[]): Promise<number> {
    // Get the MUG/MU price for point calculations
    const mugMuPrice = await this.getMugMuPrice();
    
    let totalPoints = 0;
    
    // Calculate points for tokens
    for (const holding of tokenHoldings) {
      // Skip tokens with zero balance
      if (holding.balanceFormatted === 0) {
        continue;
      }
      
      // Calculate points based on token symbol
      switch (holding.tokenSymbol) {
        case 'MU':
          totalPoints += 2 * holding.balanceFormatted;
          break;
        case 'MUG':
          totalPoints += 2 * holding.balanceFormatted * mugMuPrice;
          break;
        case 'MUO':
          totalPoints += 1.1 * 2 * holding.balanceFormatted * mugMuPrice;
          break;
        case 'MUV':
          totalPoints += 10 * 1.1 * 2 * holding.balanceFormatted * mugMuPrice;
          break;
        default:
          // Unknown token, no points
          break;
      }
    }
    
    // Calculate points for NFTs
    for (const holding of nftHoldings) {
      if (holding.tokenName === 'Mu Pups') {
        totalPoints += holding.tokenCount * 10 * 2 * mugMuPrice;
      }
    }
    
    return totalPoints;
  }
  
  /**
   * Check if a holder is eligible for the leaderboard
   * @param tokenHoldings Token holdings
   * @param nftHoldings NFT holdings
   * @returns Whether the holder is eligible
   */
  async checkEligibility(tokenHoldings: TokenHolder[], nftHoldings: NftHolder[]): Promise<boolean> {
    // Get the MUG/MU price for dynamic calculations
    const mugMuPrice = await this.getMugMuPrice();
    
    // Check if the holder has any Mu Pups NFTs
    const hasMuPups = nftHoldings.some(holding => 
      holding.tokenName === 'Mu Pups' && holding.tokenCount > 0
    );
    
    // Check if the holder meets the minimum balance for any token
    let meetsTokenMinimum = false;
    
    for (const holding of tokenHoldings) {
      // Dynamic minimum balances based on MUG/MU price
      let minBalance = 0;
      
      if (holding.balanceFormatted === 0) {
        continue; // Skip tokens with zero balance
      }
      
      // Calculate minimum balances dynamically
      switch (true) {
        case /^MU$/.test(holding.tokenSymbol || ''):
          minBalance = 100;
          break;
        case /^MUG$/.test(holding.tokenSymbol || ''):
          minBalance = 100 / mugMuPrice;
          break;
        case /^MUO$/.test(holding.tokenSymbol || ''):
          minBalance = 100 / (1.1 * mugMuPrice);
          break;
        case /^MUV$/.test(holding.tokenSymbol || ''):
          minBalance = 100 / (10 * 1.1 * mugMuPrice);
          break;
        default:
          // For other tokens, use a default minimum balance
          minBalance = 0;
      }
      
      // Check if the holder meets the minimum balance
      if (holding.balanceFormatted >= minBalance) {
        if (process.env.VERBOSE === 'true') {
          console.log(`Address ${holding.address} is eligible with ${holding.balanceFormatted} ${holding.tokenSymbol} (min: ${minBalance})`);
        }
        meetsTokenMinimum = true;
        break;
      }
    }
    
    // A holder is eligible if they have any Mu Pups NFTs or meet the minimum balance for any token
    return hasMuPups || meetsTokenMinimum;
  }
  
  /**
   * Get the MUG/MU price for point calculations
   * @returns The MUG/MU price
   */
  public async getMugMuPrice(): Promise<number> {
    try {
      if (this.mugMuPrice === 0) {
        const price = await this.priceProviderContract.getMugMuPrice();
        // Remove 18 decimal places as specified
        this.mugMuPrice = Number(ethers.formatUnits(price, 18));
        console.log(`Retrieved MUG/MU price from contract: ${this.mugMuPrice}`);
      }
      return this.mugMuPrice;
    } catch (error) {
      console.error('Error getting MUG/MU price:', error);
      // Default fallback price if contract call fails
      return 2.0;
    }
  }
  
  /**
   * Load the leaderboard configuration
   * @returns The leaderboard configuration
   */
  loadConfig(): LeaderboardConfig {
    return loadLeaderboardConfig('mu');
  }
  
  /**
   * Get the output file name for this leaderboard
   * @returns The output file name
   */
  getOutputFileName(): string {
    return 'mu_leaderboard.json';
  }
}
