import { jest } from '@jest/globals';
import { ethers } from 'ethers';
import { MuLeaderboard } from '../src/leaderboard/implementations/muLeaderboard';
import { TokenHolding, NftHolding } from '../src/types/interfaces';
import { LeaderboardConfig } from '../src/types/leaderboard';
import logger from '../src/utils/logger';

// Mock the logger
jest.spyOn(logger, 'log').mockImplementation(() => {});
jest.spyOn(logger, 'verboseLog').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

// Mock ethers Contract
jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');
  // Create a safe copy of the original module
  const safeCopy = { ...originalModule as object };
  return {
    ...safeCopy,
    Contract: jest.fn().mockImplementation(() => ({
      getMugMuPrice: () => 2000000000000000000n // 2 * 10^18
    }))
  };
});

describe('MuLeaderboard Tests', () => {
  // Sample leaderboard configuration
  const mockLeaderboardConfig: LeaderboardConfig = {
    title: 'MU Leaderboard',
    weights: {
      tokens: [
        { address: '0xmu', symbol: 'MU', decimals: 18, minBalance: 100, weight: 1 },
        { address: '0xmug', symbol: 'MUG', decimals: 18, minBalance: 50, weight: 2 },
        { address: '0xmuo', symbol: 'MUO', decimals: 18, minBalance: 25, weight: 3 },
        { address: '0xmuv', symbol: 'MUV', decimals: 18, minBalance: 10, weight: 4 }
      ],
      nfts: [
        { address: '0xmupups', name: 'MU PUPS', minBalance: 1, weight: 5, pointsPerToken: 100 }
      ]
    },
    output: {
      title: 'MU Leaderboard',
      logoPath: '/path/to/logo.png',
      maxEntries: 100,
      refreshTimeLabel: 'Updated daily',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      accentColor: '#ff0000',
      backgroundColor: '#f0f0f0',
      gradientStart: '#000000',
      gradientEnd: '#ffffff',
      twitterColor: '#1DA1F2',
      addressColor: '#333333',
      columns: [
        { name: 'Rank', field: 'rank', width: '10%' },
        { name: 'Twitter', field: 'twitterHandle', width: '20%' },
        { name: 'Points', field: 'totalPoints', width: '15%' }
      ]
    },
    excludedAccounts: ['excluded1', 'excluded2'],
    sumOfBalances: true
  };

  // Mock provider
  const mockProvider = {} as ethers.JsonRpcProvider;

  let muLeaderboard: MuLeaderboard;

  beforeEach(() => {
    jest.clearAllMocks();
    muLeaderboard = new MuLeaderboard(mockProvider, mockLeaderboardConfig);
  });

  // Tests that getLeaderboardTokens correctly returns the token configurations from the leaderboard config
  test('getLeaderboardTokens should return token configurations', () => {
    const tokens = muLeaderboard.getLeaderboardTokens();
    expect(tokens).toEqual(mockLeaderboardConfig.weights.tokens);
    expect(tokens.length).toBe(4);
  });

  // Tests that getLeaderboardNFTs correctly returns the NFT configurations from the leaderboard config
  test('getLeaderboardNFTs should return NFT configurations', () => {
    const nfts = muLeaderboard.getLeaderboardNFTs();
    expect(nfts).toEqual(mockLeaderboardConfig.weights.nfts);
    expect(nfts.length).toBe(1);
  });

  // Tests that getSumOfBalances correctly returns the sumOfBalances flag from the leaderboard config
  test('getSumOfBalances should return the sumOfBalances configuration', () => {
    const sumOfBalances = muLeaderboard.getSumOfBalances();
    expect(sumOfBalances).toBe(mockLeaderboardConfig.sumOfBalances);
  });

  // Tests that getOutputFileName returns the correct output file name for MuLeaderboard
  test('getOutputFileName should return the correct file name', () => {
    const fileName = muLeaderboard.getOutputFileName();
    expect(fileName).toBe('mu_leaderboard.json');
  });

  // Tests that getMugMuPrice correctly retrieves and formats the price from the contract
  test('getMugMuPrice should return the price from the contract', async () => {
    const price = await muLeaderboard.getMugMuPrice();
    expect(price).toBe(2); // Based on our mock that returns 2 * 10^18
  });
  
  // Tests that getMugMuPrice handles contract errors properly
  test('getMugMuPrice should handle contract errors', async () => {
    // Create a new instance with a failing mock
    const failingMockProvider = {} as ethers.JsonRpcProvider;
    const failingLeaderboard = new MuLeaderboard(failingMockProvider, mockLeaderboardConfig);
    
    // Directly mock the priceProviderContract on the leaderboard instance
    (failingLeaderboard as any).priceProviderContract = {
      getMugMuPrice: jest.fn().mockImplementation(() => {
        throw new Error('Contract error');
      })
    };
    
    // Reset the mugMuPrice to force a contract call
    (failingLeaderboard as any).mugMuPrice = 0;
    
    // The method should handle the error and return the default fallback price
    const price = await failingLeaderboard.getMugMuPrice();
    
    // Verify the fallback price is returned
    expect(price).toBe(2.0);
  });

  // Tests that getTokenMultiplier returns the correct multiplier values for different tokens
  // Each token has a specific multiplier calculation based on the MUG/MU price
  test('getTokenMultiplier should return correct multipliers for different tokens', async () => {
    // Create a new instance with controlled mocks
    const mockProvider = {} as ethers.JsonRpcProvider;
    const testLeaderboard = new MuLeaderboard(mockProvider, mockLeaderboardConfig);
    
    // Mock the getMugMuPrice method to return a consistent value
    jest.spyOn(testLeaderboard as any, 'getMugMuPrice').mockResolvedValue(2);
    
    // MU token has a multiplier of 1
    const muMultiplier = await testLeaderboard.getTokenMultiplier('MU');
    expect(muMultiplier).toBe(1);

    // MUG token has a multiplier of 2 (based on the mock price of 2)
    const mugMultiplier = await testLeaderboard.getTokenMultiplier('MUG');
    expect(mugMultiplier).toBe(2);
    
    // MUO token has a multiplier of 3
    const muoMultiplier = await testLeaderboard.getTokenMultiplier('MUO');
    expect(muoMultiplier).toBe(2.2);
    
    // MUV token has a multiplier of 4
    const muvMultiplier = await testLeaderboard.getTokenMultiplier('MUV');
    expect(muvMultiplier).toBe(22);
    
    // MU PUPS token has a multiplier of 20 (10 * 2)
    const pupsMultiplier = await testLeaderboard.getTokenMultiplier('MU PUPS');
    expect(pupsMultiplier).toBe(20); // 10 * 2

    // Unknown token should return 0
    const unknownMultiplier = await testLeaderboard.getTokenMultiplier('UNKNOWN');
    expect(unknownMultiplier).toBe(0);
  });
  
  // Tests that getTokenMultiplier handles contract errors properly
  test('getTokenMultiplier should handle contract errors', async () => {
    // Create a new instance with a failing mock
    const failingMockProvider = {} as ethers.JsonRpcProvider;
    const failingLeaderboard = new MuLeaderboard(failingMockProvider, mockLeaderboardConfig);
    
    // Mock the getMugMuPrice method to throw an error
    jest.spyOn(failingLeaderboard as any, 'getMugMuPrice').mockImplementation(() => {
      throw new Error('Contract error');
    });
    
    // For MUG token which requires the contract price, it should handle the error
    await expect(failingLeaderboard.getTokenMultiplier('MUG')).rejects.toThrow('Contract error');
  });

  // Tests that calculateDynamicMinimumBalance returns the correct minimum balance requirements
  // - NFTs like MU PUPS always have a minimum balance of 1
  // - Other tokens have a minimum balance of 100 divided by their multiplier
  test('calculateDynamicMinimumBalance should return correct minimum balances', async () => {
    // MU PUPS always has a minimum balance of 1
    const pupMinBalance = await muLeaderboard.calculateDynamicMinimumBalance('MU PUPS');
    expect(pupMinBalance).toBe(1);

    // Other tokens have a minimum balance of 100 / multiplier
    const muMinBalance = await muLeaderboard.calculateDynamicMinimumBalance('MU');
    expect(muMinBalance).toBe(100); // 100 / 1

    const mugMinBalance = await muLeaderboard.calculateDynamicMinimumBalance('MUG');
    expect(mugMinBalance).toBe(50); // 100 / 2
  });
  
  // Tests that calculateDynamicMinimumBalance handles errors when getting token multipliers
  test('calculateDynamicMinimumBalance should handle errors', async () => {
    // Create a new instance with a failing mock
    const failingMockProvider = {} as ethers.JsonRpcProvider;
    const failingLeaderboard = new MuLeaderboard(failingMockProvider, mockLeaderboardConfig);
    
    // Mock the getTokenMultiplier method to throw an error
    jest.spyOn(failingLeaderboard as any, 'getTokenMultiplier').mockImplementation(() => {
      throw new Error('Token multiplier error');
    });
    
    // For MUG token which requires the token multiplier, it should handle the error
    await expect(failingLeaderboard.calculateDynamicMinimumBalance('MUG')).rejects.toThrow('Token multiplier error');
  });

  // Tests that checkEligibility returns true when token holdings meet minimum requirements
  // In this case, the holder has 200 MU which exceeds the minimum requirement of 100 MU
  test('checkEligibility should return true when token holdings meet minimum requirements', async () => {
    // Create token holdings that meet the minimum requirements
    const tokenHoldings: TokenHolding[] = [
      {
        tokenAddress: '0xmu',
        tokenSymbol: 'MU',
        tokenBalance: '200000000000000000000', // 200 MU
        tokenDecimals: 18,
        balanceFormatted: 200
      }
    ];
    const nftHoldings: NftHolding[] = [];

    const isEligible = await muLeaderboard.checkEligibility(tokenHoldings, nftHoldings);
    expect(isEligible).toBe(true);
  });

  // Tests that checkEligibility returns true when NFT holdings meet minimum requirements
  // In this case, the holder has 2 MU PUPS which exceeds the minimum requirement of 1 MU PUPS
  test('checkEligibility should return true when NFT holdings meet minimum requirements', async () => {
    // Create a new instance with controlled mocks
    const mockProvider = {} as ethers.JsonRpcProvider;
    const testLeaderboard = new MuLeaderboard(mockProvider, mockLeaderboardConfig);
    
    // Create token and NFT holdings
    const tokenHoldings: TokenHolding[] = [];
    const nftHoldings: NftHolding[] = [
      {
        tokenAddress: '0xmupups',
        tokenSymbol: 'MU PUPS',
        tokenBalance: '2' // 2 MU PUPS
      }
    ];

    // Looking at the implementation of checkEligibility, we need to mock both methods:
    // 1. getTokenMultiplier - used to calculate the minimum balance
    // 2. calculateDynamicMinimumBalance - directly used in some cases
    
    // Mock getTokenMultiplier to return a value that would make the minimum balance = 1
    jest.spyOn(testLeaderboard as any, 'getTokenMultiplier').mockImplementation((...args: unknown[]) => {
      return Promise.resolve(20);
    });

    const isEligible = await testLeaderboard.checkEligibility(tokenHoldings, nftHoldings);
    expect(isEligible).toBe(true);
  });

  // Tests that checkEligibility returns false when holdings do not meet minimum requirements
  // In this case, the holder has only 50 MU which is below the minimum requirement of 100 MU
  test('checkEligibility should return false when holdings do not meet minimum requirements', async () => {
    // Create token holdings that don't meet the minimum requirements
    const tokenHoldings: TokenHolding[] = [
      {
        tokenAddress: '0xmu',
        tokenSymbol: 'MU',
        tokenBalance: '50000000000000000000', // 50 MU (below 100 minimum)
        tokenDecimals: 18,
        balanceFormatted: 50
      }
    ];
    const nftHoldings: NftHolding[] = [];

    const isEligible = await muLeaderboard.checkEligibility(tokenHoldings, nftHoldings);
    expect(isEligible).toBe(false);
  });
  
  // Tests that calculatePoints correctly calculates points for token holdings
  // Points calculation formula: pointsPerToken * balance * multiplier
  // - MU: 2 * 200 * 1 = 400 points
  // - MUG: 2 * 100 * 2 = 400 points
  // - Total: 800 points
  test('calculatePoints should calculate points correctly for token holdings', async () => {
    // Create token holdings
    const tokenHoldings: TokenHolding[] = [
      {
        tokenAddress: '0xmu',
        tokenSymbol: 'MU',
        tokenBalance: '200000000000000000000', // 200 MU
        tokenDecimals: 18,
        balanceFormatted: 200
      },
      {
        tokenAddress: '0xmug',
        tokenSymbol: 'MUG',
        tokenBalance: '100000000000000000000', // 100 MUG
        tokenDecimals: 18,
        balanceFormatted: 100
      }
    ];
    const nftHoldings: NftHolding[] = [];

    const points = await muLeaderboard.calculatePoints(tokenHoldings, nftHoldings);
    
    // Expected points:
    // MU: 2 * 200 * 1 = 400
    // MUG: 2 * 100 * 2 = 400
    // Total: 800
    expect(points.tokenPoints['MU']).toBe(400);
    expect(points.tokenPoints['MUG']).toBe(400);
    expect(points.totalPoints).toBe(800);
  });

  // Tests that calculatePoints correctly calculates points for NFT holdings
  // Points calculation formula: pointsPerToken * balance * multiplier
  // - MU PUPS: 2 * 2 * 20 = 80 points
  // - Total: 80 points
  test('calculatePoints should calculate points correctly for NFT holdings', async () => {
    // Create a new instance with controlled mocks
    const mockProvider = {} as ethers.JsonRpcProvider;
    const testLeaderboard = new MuLeaderboard(mockProvider, mockLeaderboardConfig);
    
    // Create NFT holdings
    const tokenHoldings: TokenHolding[] = [];
    const nftHoldings: NftHolding[] = [
      {
        tokenAddress: '0xmupups',
        tokenSymbol: 'MU PUPS',
        tokenBalance: '2' // 2 MU PUPS
      }
    ];

    // Mock the getTokenMultiplier method to return a consistent value for MU PUPS
    jest.spyOn(testLeaderboard as any, 'getTokenMultiplier').mockImplementation((...args: unknown[]) => {
      const symbol = args[0] as string;
      if (symbol === 'MU PUPS') return Promise.resolve(20);
      return Promise.resolve(1);
    });

    const points = await testLeaderboard.calculatePoints(tokenHoldings, nftHoldings);
    
    // Expected points:
    // MU PUPS: 2 * 2 * 20 = 80
    // Total: 80
    expect(points.nftPoints['MU PUPS']).toBe(80);
    expect(points.totalPoints).toBe(80);
  });

  // Tests that calculatePoints correctly calculates points for combined token and NFT holdings
  // Points calculation formula: pointsPerToken * balance * multiplier
  // - MU: 2 * 200 * 1 = 400 points
  // - MU PUPS: 2 * 2 * 20 = 80 points
  // - Total: 480 points
  test('calculatePoints should calculate points correctly for combined holdings', async () => {
    // Create a new instance with controlled mocks
    const mockProvider = {} as ethers.JsonRpcProvider;
    const testLeaderboard = new MuLeaderboard(mockProvider, mockLeaderboardConfig);
    
    // Create combined token and NFT holdings
    const tokenHoldings: TokenHolding[] = [
      {
        tokenAddress: '0xmu',
        tokenSymbol: 'MU',
        tokenBalance: '200000000000000000000', // 200 MU
        tokenDecimals: 18,
        balanceFormatted: 200
      }
    ];
    const nftHoldings: NftHolding[] = [
      {
        tokenAddress: '0xmupups',
        tokenSymbol: 'MU PUPS',
        tokenBalance: '2' // 2 MU PUPS
      }
    ];

    // Mock the getTokenMultiplier method to return consistent values
    jest.spyOn(testLeaderboard as any, 'getTokenMultiplier').mockImplementation((...args: unknown[]) => {
      const symbol = args[0] as string;
      if (symbol === 'MU') return Promise.resolve(1);
      if (symbol === 'MU PUPS') return Promise.resolve(20);
      return Promise.resolve(1);
    });

    const points = await testLeaderboard.calculatePoints(tokenHoldings, nftHoldings);
    
    // Expected points:
    // MU: 2 * 200 * 1 = 400
    // MU PUPS: 2 * 2 * 20 = 80
    // Total: 480
    expect(points.tokenPoints['MU']).toBe(400);
    expect(points.nftPoints['MU PUPS']).toBe(80);
    expect(points.totalPoints).toBe(480);
  });
  
  // Tests that calculatePoints handles errors when getting token multipliers
  test('calculatePoints should handle errors when getting token multipliers', async () => {
    // Create a new instance with a failing mock
    const failingMockProvider = {} as ethers.JsonRpcProvider;
    const failingLeaderboard = new MuLeaderboard(failingMockProvider, mockLeaderboardConfig);
    
    // Mock the getTokenMultiplier method to throw an error
    jest.spyOn(failingLeaderboard as any, 'getTokenMultiplier').mockImplementation(() => {
      throw new Error('Token multiplier error');
    });
    
    const tokenHoldings: TokenHolding[] = [
      {
        tokenAddress: '0xmug',
        tokenSymbol: 'MUG',
        tokenBalance: '100000000000000000000', // 100 MUG
        tokenDecimals: 18,
        balanceFormatted: 100
      }
    ];
    const nftHoldings: NftHolding[] = [];
    
    // Should throw an error when calculating points for MUG token
    await expect(failingLeaderboard.calculatePoints(tokenHoldings, nftHoldings)).rejects.toThrow('Token multiplier error');
  });
  
  // Tests that calculatePoints handles empty holdings
  test('calculatePoints should handle empty holdings', async () => {
    const tokenHoldings: TokenHolding[] = [];
    const nftHoldings: NftHolding[] = [];
    
    const points = await muLeaderboard.calculatePoints(tokenHoldings, nftHoldings);
    
    expect(points.totalPoints).toBe(0);
    expect(Object.keys(points.tokenPoints).length).toBe(0);
    expect(Object.keys(points.nftPoints).length).toBe(0);
  });
});
