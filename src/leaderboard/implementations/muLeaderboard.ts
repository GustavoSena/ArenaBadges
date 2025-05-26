import { BaseLeaderboard, LeaderboardConfig } from '../../types/leaderboard';
import { TokenHolding, NftHolding } from '../../types/interfaces';
import { ethers } from 'ethers';
import { LeaderboardTokenConfig, LeaderboardNftConfig, HolderPoints } from '../../types/leaderboard';
import logger from '../../utils/logger';
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
  constructor(provider: ethers.JsonRpcProvider, leaderboardConfig: LeaderboardConfig) {
    super(provider, leaderboardConfig);
    
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
   * Calculate points for a holder
   * @param tokenHoldings Token holdings
   * @param nftHoldings NFT holdings
   * @returns Total points
   */
  public async calculatePoints(tokenHoldings: TokenHolding[], nftHoldings: NftHolding[]): Promise<HolderPoints> {
    let holderPoints: HolderPoints = {
      totalPoints: 0,
      tokenPoints: {},
      nftPoints: {}
    };
    
    // Calculate points for tokens
    for (const holding of tokenHoldings) {
      holderPoints.tokenPoints[holding.tokenSymbol] = 2 * holding.balanceFormatted! * await this.getTokenMultiplier(holding.tokenSymbol);
      logger.verboseLog(`Token points for ${holding.tokenSymbol} for balance ${holding.balanceFormatted}: ${holderPoints.tokenPoints[holding.tokenSymbol]}`);
      holderPoints.totalPoints += holderPoints.tokenPoints[holding.tokenSymbol];
    }
    
    // Calculate points for NFTs
    for (const holding of nftHoldings) {
        holderPoints.nftPoints[holding.tokenSymbol] = 2 * +holding.tokenBalance * await this.getTokenMultiplier(holding.tokenSymbol);
        logger.verboseLog(`NFT points for ${holding.tokenSymbol} for balance ${holding.tokenBalance}: ${holderPoints.nftPoints[holding.tokenSymbol]}`);
        holderPoints.totalPoints += holderPoints.nftPoints[holding.tokenSymbol];
    }
    
    logger.verboseLog(`Total points for ${tokenHoldings.length} token holdings and ${nftHoldings.length} NFT holdings: ${holderPoints.totalPoints}`);
    return holderPoints;
  }
  
  /**
   * Check if a holder is eligible for the leaderboard
   * @param tokenHoldings Token holdings
   * @param nftHoldings NFT holdings
   * @returns Whether the holder is eligible
   */
  public async checkEligibility(tokenHoldings: TokenHolding[], nftHoldings: NftHolding[]): Promise<boolean> {
    
    // Check if the holder meets the minimum balance for any token
    let meetsTokenMinimum = false;
    let meetsNftMinimum = false;
    
    for (const holding of tokenHoldings) {
      // Dynamic minimum balances based on MUG/MU price

      let minBalance = 100 / await this.getTokenMultiplier(holding.tokenSymbol);
      if (holding.tokenBalance === '0')
        continue; // Skip tokens with zero balance
      
      // Check if the holder meets the minimum balance
      if (holding.balanceFormatted! >= minBalance) {
        meetsTokenMinimum = true;
        break;
      }
    }

    for (const holding of nftHoldings) {
      // Dynamic minimum balances based on MUG/MU price

      let minBalance = Math.ceil(100 / await this.getTokenMultiplier(holding.tokenSymbol));
      const formattedBalance = +holding.tokenBalance;
      if (formattedBalance === 0) 
        continue; // Skip tokens with zero balance
      
      // Check if the holder meets the minimum balance
      if (formattedBalance >= minBalance) {
        meetsNftMinimum = true;
        break;
      }
    }
    
    // A holder is eligible if they have any Mu Pups NFTs or meet the minimum balance for any token
    return meetsNftMinimum || meetsTokenMinimum;
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
        this.mugMuPrice = +ethers.formatUnits(price, 18);
        logger.log(`Retrieved MUG/MU price from contract: ${this.mugMuPrice}`);
      }
      return this.mugMuPrice;
    } catch (error) {
      logger.error('Error getting MUG/MU price:', error);
      // Default fallback price if contract call fails
      return 2.0;
    }
  }
  
  /**
   * Calculate dynamic minimum balance for a token based on MUG/MU price
   * @param tokenSymbol The token symbol
   * @returns The calculated minimum balance
   */
  public async calculateDynamicMinimumBalance(tokenSymbol: string): Promise<number> {
    if(tokenSymbol.toLowerCase() === 'mu pups') return 1;
    return 100/ await this.getTokenMultiplier(tokenSymbol);
  }
  /**
   * Calculate dynamic minimum balance for a token based on MUG/MU price
   * @param tokenSymbol The token symbol
   * @returns The calculated minimum balance
   */
  public async getTokenMultiplier(tokenSymbol: string): Promise<number> {
    
    // Get the MUG/MU price
    const mugMuPrice = await this.getMugMuPrice();
    
    // Calculate dynamic minimum balance based on token symbol
    let multiplier = 0;
    
    switch (tokenSymbol.toLowerCase()) {
      case 'mu':
        multiplier = 1;
        break;
      case 'mug':
        multiplier = mugMuPrice;
        break;
      case 'muo':
        multiplier = 1.1 * mugMuPrice;
        break;
      case 'muv':
        multiplier = 10 * 1.1 * mugMuPrice;
        break;
      case 'mu pups':
        multiplier = 10 * mugMuPrice;
        break;
      default:
        multiplier = 0;
    }
    
    return multiplier;
  }
  /**
   * Get the output file name for this leaderboard
   * @returns The output file name
   */
  getOutputFileName(): string {
    return 'mu_leaderboard.json';
  }
}
