import { TokenHolder, NftHolder } from './interfaces';
import { LeaderboardConfig, HolderPoints, LeaderboardEntry, Leaderboard } from './leaderboard';
import { ethers } from 'ethers';

/**
 * Interface for price provider contract
 */
export interface PriceProvider {
  /**
   * Retrieves the MUG/MU price from the contract
   * @returns Promise resolving to the MUG/MU price
   */
  getMugMuPrice(): Promise<number>;
}

/**
 * Base Leaderboard class that defines the common structure for all leaderboard implementations
 */
export abstract class BaseLeaderboard {
  protected config: LeaderboardConfig;
  protected provider: ethers.JsonRpcProvider;
  
  /**
   * Constructor for the base leaderboard class
   * @param config The leaderboard configuration
   * @param provider The ethers provider for blockchain interactions
   */
  constructor(config: LeaderboardConfig, provider: ethers.JsonRpcProvider) {
    this.config = config;
    this.provider = provider;
  }
  
  /**
   * Abstract method to calculate points for a token holder
   * @param holder The token holder information
   * @param tokenSymbol The symbol of the token
   * @returns Promise resolving to the calculated points
   */
  abstract calculateTokenPoints(holder: TokenHolder, tokenSymbol: string): Promise<number>;
  
  /**
   * Abstract method to calculate points for an NFT holder
   * @param holder The NFT holder information
   * @returns Promise resolving to the calculated points
   */
  abstract calculateNftPoints(holder: NftHolder): Promise<number>;
  
  /**
   * Generate leaderboard from holder points
   * @param holderPoints Array of holder points to generate the leaderboard from
   * @param maxEntries Maximum number of entries to include in the leaderboard
   * @returns The generated leaderboard
   */
  generateLeaderboard(holderPoints: HolderPoints[], maxEntries: number = 100): Leaderboard {
    // Sort holders by total points (descending)
    const sortedHolders = holderPoints.sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Generate leaderboard entries with rankings
    const entries: LeaderboardEntry[] = sortedHolders.slice(0, maxEntries).map((holder, index) => ({
      rank: index + 1,
      twitterHandle: holder.twitterHandle as string, // We already filtered for non-null handles
      profileImageUrl: holder.profileImageUrl,
      address: holder.address,
      totalPoints: holder.totalPoints,
      tokenPoints: holder.tokenPoints,
      nftPoints: holder.nftPoints
    }));
    
    // Create the leaderboard
    return {
      timestamp: new Date().toISOString(),
      entries
    };
  }
}

/**
 * MU Leaderboard implementation with custom point calculation logic
 */
export class MuLeaderboard extends BaseLeaderboard {
  private priceProviderContract: ethers.Contract;
  private mugMuPrice: number | null = null;
  
  /**
   * Constructor for the MU leaderboard
   * @param config The leaderboard configuration
   * @param provider The ethers provider for blockchain interactions
   */
  constructor(config: LeaderboardConfig, provider: ethers.JsonRpcProvider) {
    super(config, provider);
    
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
   * Get the MUG/MU price from the contract
   * @returns Promise resolving to the MUG/MU price
   */
  async getMugMuPrice(): Promise<number> {
    if (this.mugMuPrice !== null) {
      return this.mugMuPrice;
    }
    
    try {
      const price = await this.priceProviderContract.getMugMuPrice();
      // Remove 18 decimal places as specified
      this.mugMuPrice = Number(ethers.formatUnits(price, 18));
      console.log(`Retrieved MUG/MU price from contract: ${this.mugMuPrice}`);
      return this.mugMuPrice;
    } catch (error) {
      console.error('Error fetching MUG/MU price from contract:', error);
      // Default fallback price if contract call fails
      return 1.0;
    }
  }
  
  /**
   * Calculate points for a token holder based on MU token rules
   * @param holder The token holder information
   * @param tokenSymbol The symbol of the token
   * @returns Promise resolving to the calculated points
   */
  async calculateTokenPoints(holder: TokenHolder, tokenSymbol: string): Promise<number> {
    const balance = holder.balanceFormatted;
    
    // Get the MUG/MU price for calculations
    const mugMuPrice = await this.getMugMuPrice();
    
    switch (tokenSymbol) {
      case 'MU':
        // MU is worth 2 points per token
        return balance * 2;
        
      case 'MUG':
        // MUG is worth the contract price
        return balance * mugMuPrice;
        
      case 'MUO':
        // MUO is worth 1.1x MUG
        return balance * (mugMuPrice * 1.1);
        
      case 'MUV':
        // MUV is worth 10x MUO
        return balance * (mugMuPrice * 1.1 * 10);
        
      default:
        // Default case for unknown tokens
        return balance;
    }
  }
  
  /**
   * Calculate points for an NFT holder
   * @param holder The NFT holder information
   * @returns Promise resolving to the calculated points
   */
  async calculateNftPoints(holder: NftHolder): Promise<number> {
    // Get the MUG/MU price for calculations
    const mugMuPrice = await this.getMugMuPrice();
    
    // Mu Pups are worth 10x MUG
    if (holder.tokenName === 'Mu Pups') {
      return holder.tokenCount * (mugMuPrice * 10);
    }
    
    // Default for other NFTs
    return holder.tokenCount * 100;
  }
}
