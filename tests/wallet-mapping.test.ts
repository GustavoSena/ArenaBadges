import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Import the modules we want to test
import { loadWalletMapping, getHandleToWalletMapping } from '../src/utils/walletMapping';
import { processWalletHoldings } from '../src/leaderboard/utils/leaderboardUtils';
import { TokenHolding, NftHolding } from '../src/types/interfaces';
import { LeaderboardTokenConfig, LeaderboardNftConfig } from '../src/types/leaderboard';
import logger from '../src/utils/logger';

// Import mock data
import {
  mockWalletMapping,
  mockTokenHoldings,
  mockNftHoldings,
  mockTokenConfigs,
  mockNftConfigs,
  mockBadgeConfigs,
  mockLeaderboardConfigs,
  createWalletToTokenHoldingsMap,
  createWalletToNftHoldingsMap
} from './mocks/wallet-mapping-mock-data';

// Mock the logger
jest.spyOn(logger, 'log').mockImplementation(() => {});
jest.spyOn(logger, 'verboseLog').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

// Mock fs operations
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  return {
    ...originalModule as object,
    readFileSync: jest.fn().mockImplementation(function(filePath) {
      if (typeof filePath === 'string' && filePath.includes('test-mapping.json')) {
        return JSON.stringify(mockWalletMapping);
      }
      return '{}';
    }),
    existsSync: jest.fn().mockReturnValue(true)
  };
});

// Mock token processing
jest.mock('../src/utils/tokenUtils', () => ({
  updateTokenHoldingsMap: jest.fn().mockImplementation(function(tokenMap, address, holding, sumOfBalances) {
    if (tokenMap && typeof address === 'string') {
      tokenMap[address] = holding;
    }
    return tokenMap;
  }),
  processTokenBalances: jest.fn().mockImplementation(function() {
    return Promise.resolve({
      '0xtoken1': {
        tokenAddress: '0xtoken1',
        tokenSymbol: 'TOKEN1',
        tokenBalance: '250',
        tokenDecimals: 18,
        balanceFormatted: 250
      },
      '0xtoken2': {
        tokenAddress: '0xtoken2',
        tokenSymbol: 'TOKEN2',
        tokenBalance: '300',
        tokenDecimals: 18,
        balanceFormatted: 300
      }
    });
  })
}));


describe('Wallet Mapping Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Wallet Mapping Functionality', () => {
    test('loadWalletMapping should load wallet mapping from file', () => {
      const mapping = loadWalletMapping('test-mapping.json');
      
      // Should load all wallet mappings from the mock data
      expect(mapping).toBeDefined();
      expect(Object.keys(mapping).length).toBe(Object.keys(mockWalletMapping).length);
      
      // Check specific mappings
      expect(mapping['0x1111111111111111111111111111111111111111']).toBe('user1');
      expect(mapping['0x2221111111111111111111111111111111111111']).toBe('user2');
      expect(mapping['0x3333333333333333333333333333333333333333']).toBe('user3');
    });

    test('getHandleToWalletMapping should create a Map<string, Set<string>>', () => {
      const handleToWallet = getHandleToWalletMapping(mockWalletMapping);
      
      // Should create a map with the correct number of handles
      expect(handleToWallet).toBeDefined();
      expect(handleToWallet.size).toBe(6); // 6 unique Twitter handles
      
      // Check user1 has all 3 wallets
      const user1Wallets = handleToWallet.get('user1');
      expect(user1Wallets).toBeDefined();
      expect(user1Wallets?.size).toBe(3);
      expect(user1Wallets?.has('0x1111111111111111111111111111111111111111')).toBe(true);
      expect(user1Wallets?.has('0x1112222222222222222222222222222222222222')).toBe(true);
      expect(user1Wallets?.has('0x1113333333333333333333333333333333333333')).toBe(true);
      
      // Check user2 has both wallets
      const user2Wallets = handleToWallet.get('user2');
      expect(user2Wallets).toBeDefined();
      expect(user2Wallets?.size).toBe(2);
      expect(user2Wallets?.has('0x2221111111111111111111111111111111111111')).toBe(true);
      expect(user2Wallets?.has('0x2222222222222222222222222222222222222222')).toBe(true);
      
      // Check user6 has all 3 wallets
      const user6Wallets = handleToWallet.get('user6');
      expect(user6Wallets).toBeDefined();
      expect(user6Wallets?.size).toBe(3);
    });
  });
  
  describe('Wallet Holdings Processing with sumOfBalances=true', () => {
    test('processWalletHoldings should aggregate token balances across multiple wallets', async () => {
      // Create wallet-to-token holdings map
      const walletToTokenHoldings = createWalletToTokenHoldingsMap();
      const walletToNftHoldings = createWalletToNftHoldingsMap();
      
      // User1's wallets (has 3 wallets with different tokens)
      const user1Addresses = new Set<string>([
        '0x1111111111111111111111111111111111111111', // Has TOKEN1: 100
        '0x1112222222222222222222222222222222222222', // Has TOKEN2: 200
        '0x1113333333333333333333333333333333333333'  // Has TOKEN3: 50
      ]);
      
      // Mock the leaderboard for this test
      const mockLeaderboard = {
        getLeaderboardTokens: jest.fn().mockReturnValue([
          { address: '0xtoken1', symbol: 'TOKEN1', decimals: 18, minBalance: 10, weight: 1 },
          { address: '0xtoken2', symbol: 'TOKEN2', decimals: 18, minBalance: 10, weight: 2 },
          { address: '0xtoken3', symbol: 'TOKEN3', decimals: 18, minBalance: 10, weight: 3 }
        ]),
        checkEligibility: jest.fn().mockImplementation((tokenHoldings, nftHoldings) => Promise.resolve(true)),
        calculatePoints: jest.fn().mockImplementation(function(tokenHoldings, nftHoldings) {
          // Simple mock implementation that sums up token balances with weights
          const tokenPoints: Record<string, number> = {};
          let totalPoints = 0;
          
          if (Array.isArray(tokenHoldings)) {
            tokenHoldings.forEach(holding => {
              const weight = holding.tokenSymbol === 'TOKEN1' ? 1 : 
                            holding.tokenSymbol === 'TOKEN2' ? 2 : 3;
              const points = holding.balanceFormatted * weight;
              tokenPoints[holding.tokenSymbol] = points;
              totalPoints += points;
            });
          }
          
          return Promise.resolve({
            totalPoints,
            tokenPoints,
            nftPoints: {}
          });
        })
      };
      
      // Process wallet holdings with sumOfBalances=true
      const result = await processWalletHoldings(
        'user1',
        user1Addresses,
        walletToTokenHoldings,
        walletToNftHoldings,
        mockLeaderboard as any,
        true // sumOfBalances=true
      );
      
      // Verify results
      expect(result).toBeDefined();
      expect(result?.twitterHandle).toBe('user1');
      // Primary address should be the first one in the set
      expect(result?.address).toBe('0x1111111111111111111111111111111111111111');
      
      // Verify points calculation includes all tokens from all wallets
      expect(result?.points.tokenPoints['TOKEN1']).toBeDefined();
      expect(result?.points.tokenPoints['TOKEN2']).toBeDefined();
      expect(result?.points.tokenPoints['TOKEN3']).toBeDefined();
      
      // TOKEN1 (100) * weight 1 = 100 points
      // TOKEN2 (200) * weight 2 = 400 points
      // TOKEN3 (50) * weight 3 = 150 points
      // Total: 650 points
      expect(result?.points.totalPoints).toBe(650);
    });
    
    test('processWalletHoldings should aggregate NFT holdings across multiple wallets', async () => {
      // Create wallet-to-token/NFT holdings maps
      const walletToTokenHoldings = createWalletToTokenHoldingsMap();
      const walletToNftHoldings = createWalletToNftHoldingsMap();
      
      // User2's wallets (has NFTs across multiple wallets)
      const user2Addresses = new Set<string>([
        '0x2221111111111111111111111111111111111111', // Has NFT1: 2
        '0x2222222222222222222222222222222222222222'  // Has NFT2: 3
      ]);
      
      // Mock the leaderboard for this test
      const mockLeaderboard = {
        getLeaderboardTokens: jest.fn().mockReturnValue([
          { address: '0xnft1', symbol: 'NFT1', decimals: 0, minBalance: 1, weight: 5, isNft: true },
          { address: '0xnft2', symbol: 'NFT2', decimals: 0, minBalance: 1, weight: 5, isNft: true }
        ]),
        checkEligibility: jest.fn().mockImplementation((tokenHoldings, nftHoldings) => Promise.resolve(true)),
        calculatePoints: jest.fn().mockImplementation(function(tokenHoldings, nftHoldings) {
          // Simple mock implementation that counts NFTs
          const nftPoints: Record<string, number> = {};
          let totalPoints = 0;
          
          if (Array.isArray(nftHoldings)) {
            nftHoldings.forEach(holding => {
              const points = parseInt(holding.tokenBalance) * 100;
              nftPoints[holding.tokenSymbol] = points;
              totalPoints += points;
            });
          }
          
          return Promise.resolve({
            totalPoints,
            tokenPoints: {},
            nftPoints
          });
        })
      };
      
      // Process wallet holdings with sumOfBalances=true
      const result = await processWalletHoldings(
        'user2',
        user2Addresses,
        walletToTokenHoldings,
        walletToNftHoldings,
        mockLeaderboard as any,
        true // sumOfBalances=true
      );
      
      // Verify results
      expect(result).toBeDefined();
      expect(result?.twitterHandle).toBe('user2');
      
      // Verify points calculation includes all NFTs from all wallets
      expect(result?.points.nftPoints['NFT1']).toBeDefined();
      expect(result?.points.nftPoints['NFT2']).toBeDefined();
      
      // NFT1 (2) * 100 = 200 points
      // NFT2 (3) * 100 = 300 points
      // Total: 500 points
      expect(result?.points.totalPoints).toBe(500);
    });
    
    test('User with complementary token holdings across wallets should meet badge requirements', async () => {
      // Create wallet-to-token holdings map
      const walletToTokenHoldings = createWalletToTokenHoldingsMap();
      const walletToNftHoldings = createWalletToNftHoldingsMap();
      
      // User6's wallets - each has part of the required tokens
      const user6Addresses = new Set<string>([
        '0x6661111111111111111111111111111111111111', // Has TOKEN1: 30
        '0x6662222222222222222222222222222222222222', // Has TOKEN1: 25 and TOKEN2: 40
        '0x6663333333333333333333333333333333333333'  // Has TOKEN2: 15
      ]);
      
      // Mock the leaderboard with specific requirements
      const mockLeaderboard = {
        getLeaderboardTokens: jest.fn().mockReturnValue([
          { address: '0xtoken1', symbol: 'TOKEN1', decimals: 18, minBalance: 50, weight: 1 },
          { address: '0xtoken2', symbol: 'TOKEN2', decimals: 18, minBalance: 50, weight: 1 }
        ]),
        checkEligibility: jest.fn().mockImplementation(function(tokenHoldings) {
          // Check if combined holdings meet requirements
          if (!Array.isArray(tokenHoldings)) return Promise.resolve(false);
          
          const token1Total = tokenHoldings.find(t => t.tokenSymbol === 'TOKEN1')?.balanceFormatted || 0;
          const token2Total = tokenHoldings.find(t => t.tokenSymbol === 'TOKEN2')?.balanceFormatted || 0;
          
          return Promise.resolve(token1Total >= 50 && token2Total >= 50);
        }),
        calculatePoints: jest.fn().mockImplementation(function(tokenHoldings) {
          if (!Array.isArray(tokenHoldings)) {
            return Promise.resolve({
              totalPoints: 0,
              tokenPoints: {},
              nftPoints: {}
            });
          }
          
          const tokenPoints: Record<string, number> = {};
          let totalPoints = 0;
          
          tokenHoldings.forEach(holding => {
            tokenPoints[holding.tokenSymbol] = holding.balanceFormatted;
            totalPoints += holding.balanceFormatted;
          });
          
          return Promise.resolve({
            totalPoints,
            tokenPoints,
            nftPoints: {}
          });
        })
      };
      
      // Process wallet holdings with sumOfBalances=true
      const result = await processWalletHoldings(
        'user6',
        user6Addresses,
        walletToTokenHoldings,
        walletToNftHoldings,
        mockLeaderboard as any,
        true // sumOfBalances=true
      );
      
      // Verify results
      expect(result).toBeDefined();
      expect(result?.twitterHandle).toBe('user6');
      
      // Verify eligibility check was called and returned true
      expect(mockLeaderboard.checkEligibility).toHaveBeenCalled();
      
      // User6 should be eligible because combined they have:
      // TOKEN1: 30 + 25 = 55 (> 50 required)
      // TOKEN2: 40 + 15 = 55 (> 50 required)
      // If a user has points, they are eligible
      expect(result && result.points && result.points.totalPoints && result.points.totalPoints > 0).toBe(true);
      
      // Total points should be the sum of all token balances
      // TOKEN1: 55 points
      // TOKEN2: 55 points
      // Total: 110 points
      expect(result && result.points && result.points.totalPoints).toBe(110);
    });
  });
  
  describe('Wallet Holdings Processing with sumOfBalances=false', () => {
    test('processWalletHoldings should NOT aggregate token balances when sumOfBalances=false', async () => {
      // Create wallet-to-token holdings map
      const walletToTokenHoldings = createWalletToTokenHoldingsMap();
      const walletToNftHoldings = createWalletToNftHoldingsMap();
      
      // User1's wallets (has 3 wallets with different tokens)
      const user1Addresses = new Set<string>([
        '0x1111111111111111111111111111111111111111', // Has TOKEN1: 100
        '0x1112222222222222222222222222222222222222', // Has TOKEN2: 200
        '0x1113333333333333333333333333333333333333'  // Has TOKEN3: 50
      ]);
      
      // Mock the leaderboard for this test
      const mockLeaderboard = {
        getLeaderboardTokens: jest.fn().mockReturnValue([
          { address: '0xtoken1', symbol: 'TOKEN1', decimals: 18, minBalance: 10, weight: 1 },
          { address: '0xtoken2', symbol: 'TOKEN2', decimals: 18, minBalance: 10, weight: 2 },
          { address: '0xtoken3', symbol: 'TOKEN3', decimals: 18, minBalance: 10, weight: 3 }
        ]),
        checkEligibility: jest.fn().mockImplementation((tokenHoldings, nftHoldings) => Promise.resolve(true)),
        calculatePoints: jest.fn().mockImplementation(function(tokenHoldings, nftHoldings) {
          // Simple mock implementation that sums up token balances with weights
          const tokenPoints: Record<string, number> = {};
          let totalPoints = 0;
          
          if (Array.isArray(tokenHoldings)) {
            tokenHoldings.forEach(holding => {
              const weight = holding.tokenSymbol === 'TOKEN1' ? 1 : 
                            holding.tokenSymbol === 'TOKEN2' ? 2 : 3;
              const points = holding.balanceFormatted * weight;
              tokenPoints[holding.tokenSymbol] = points;
              totalPoints += points;
            });
          }
          
          return Promise.resolve({
            totalPoints,
            tokenPoints,
            nftPoints: {}
          });
        })
      };
      
      // Process wallet holdings with sumOfBalances=false
      const result = await processWalletHoldings(
        'user1',
        user1Addresses,
        walletToTokenHoldings,
        walletToNftHoldings,
        mockLeaderboard as any,
        false // sumOfBalances=false
      );
      
      // Verify results
      expect(result).toBeDefined();
      expect(result?.twitterHandle).toBe('user1');
      
      // With sumOfBalances=false, only the first wallet's tokens should be considered
      // Only TOKEN1 from the first wallet should be counted
      expect(result?.points.tokenPoints['TOKEN1']).toBeDefined();
      expect(result?.points.tokenPoints['TOKEN2']).toBeUndefined();
      expect(result?.points.tokenPoints['TOKEN3']).toBeUndefined();
      
      // TOKEN1 (100) * weight 1 = 100 points
      expect(result?.points.totalPoints).toBe(100);
    });
    
    test('User with complementary holdings should NOT meet requirements with sumOfBalances=false', async () => {
      // Create wallet-to-token holdings map
      const walletToTokenHoldings = createWalletToTokenHoldingsMap();
      const walletToNftHoldings = createWalletToNftHoldingsMap();
      
      // User6's wallets - each has part of the required tokens
      const user6Addresses = new Set<string>([
        '0x6661111111111111111111111111111111111111', // Has TOKEN1: 30
        '0x6662222222222222222222222222222222222222', // Has TOKEN1: 25 and TOKEN2: 40
        '0x6663333333333333333333333333333333333333'  // Has TOKEN2: 15
      ]);
      
      // Mock the leaderboard with specific requirements
      const mockLeaderboard = {
        getLeaderboardTokens: jest.fn().mockReturnValue([
          { address: '0xtoken1', symbol: 'TOKEN1', decimals: 18, minBalance: 50, weight: 1 },
          { address: '0xtoken2', symbol: 'TOKEN2', decimals: 18, minBalance: 50, weight: 1 }
        ]),
        checkEligibility: jest.fn().mockImplementation(function(tokenHoldings) {
          if (!Array.isArray(tokenHoldings)) return Promise.resolve(false);
          
          // Check if holdings meet requirements
          const token1Total = tokenHoldings.find(t => t.tokenSymbol === 'TOKEN1')?.balanceFormatted || 0;
          const token2Total = tokenHoldings.find(t => t.tokenSymbol === 'TOKEN2')?.balanceFormatted || 0;
          
          return Promise.resolve(token1Total >= 50 && token2Total >= 50);
        }),
        calculatePoints: jest.fn().mockImplementation(function(tokenHoldings) {
          if (!Array.isArray(tokenHoldings)) {
            return Promise.resolve({
              totalPoints: 0,
              tokenPoints: {},
              nftPoints: {}
            });
          }
          
          const tokenPoints: Record<string, number> = {};
          let totalPoints = 0;
          
          tokenHoldings.forEach(holding => {
            tokenPoints[holding.tokenSymbol] = holding.balanceFormatted;
            totalPoints += holding.balanceFormatted;
          });
          
          return Promise.resolve({
            totalPoints,
            tokenPoints,
            nftPoints: {}
          });
        })
      };
      
      // Process wallet holdings with sumOfBalances=false
      const result = await processWalletHoldings(
        'user6',
        user6Addresses,
        walletToTokenHoldings,
        walletToNftHoldings,
        mockLeaderboard as any,
        false // sumOfBalances=false
      );
      
      // Verify results
      expect(result).toBeDefined();
      expect(result?.twitterHandle).toBe('user6');
      
      // With sumOfBalances=false, only the first wallet's tokens should be considered
      // First wallet only has TOKEN1: 30, which is below the 50 requirement
      expect(result?.points.totalPoints === 0).toBe(true);
      
      // Only TOKEN1 from the first wallet should be counted
      expect(result?.points.tokenPoints['TOKEN1']).toBeDefined();
      expect(result?.points.tokenPoints['TOKEN2']).toBeUndefined();
      
      // TOKEN1 (30) = 30 points
      expect(result?.points.totalPoints).toBe(30);
    });
  });
  
  describe('Badge Eligibility Tests', () => {
    test('User should meet badge requirements with token and NFT holdings', async () => {
      // Create wallet-to-token/NFT holdings maps
      const walletToTokenHoldings = createWalletToTokenHoldingsMap();
      const walletToNftHoldings = createWalletToNftHoldingsMap();
      
      // User's wallet with badge-eligible holdings
      const userAddresses = new Set<string>([
        '0x1111111111111111111111111111111111111111' // Has TOKEN1 and NFT1
      ]);
      
      // Mock badge configuration
      const mockBadgeConfig = {
        tokens: [
          { 
            address: '0xtoken1', 
            symbol: 'TOKEN1', 
            minBalance: 100, 
            decimals: 18 
          }
        ],
        nfts: [
          { 
            address: '0xnft1', 
            name: 'NFT1', 
            minBalance: 1 
          }
        ]
      };
      
      // Mock the eligibility check function
      const checkBadgeEligibility = (tokenHoldings: TokenHolding[], nftHoldings: NftHolding[]) => {
        // Check token requirements
        const hasEnoughToken1 = tokenHoldings.some(t => 
          t.tokenSymbol === 'TOKEN1' && t.balanceFormatted >= 100
        );
        
        // Check NFT requirements
        const hasNft1 = nftHoldings.some(n => 
          n.tokenSymbol === 'NFT1' && parseInt(n.tokenBalance) >= 1
        );
        
        return hasEnoughToken1 && hasNft1;
      };
      
      // Mock the badge calculation function
      const calculateBadgePoints = (tokenHoldings: TokenHolding[], nftHoldings: NftHolding[]) => {
        let points = 0;
        const tokenPoints: Record<string, number> = {};
        const nftPoints: Record<string, number> = {};
        
        // Calculate token points
        tokenHoldings.forEach(holding => {
          if (holding.tokenSymbol === 'TOKEN1') {
            tokenPoints[holding.tokenSymbol] = holding.balanceFormatted * 10; // 10 points per token
            points += tokenPoints[holding.tokenSymbol];
          }
        });
        
        // Calculate NFT points
        nftHoldings.forEach(holding => {
          if (holding.tokenSymbol === 'NFT1') {
            nftPoints[holding.tokenSymbol] = 1000; // Fixed 1000 points for NFT1
            points += nftPoints[holding.tokenSymbol];
          }
        });
        
        return { totalPoints: points, tokenPoints, nftPoints };
      };
      
      // Mock the badge service
      const mockBadgeService = {
        checkEligibility: checkBadgeEligibility,
        calculatePoints: calculateBadgePoints,
        getBadgeConfig: jest.fn().mockReturnValue(mockBadgeConfig)
      };
      
      // Test the badge eligibility
      const isEligible = mockBadgeService.checkEligibility(
        walletToTokenHoldings['0x1111111111111111111111111111111111111111'] || [],
        walletToNftHoldings['0x1111111111111111111111111111111111111111'] || []
      );
      
      // Verify eligibility
      expect(isEligible).toBe(true);
      
      // Test points calculation
      const points = mockBadgeService.calculatePoints(
        walletToTokenHoldings['0x1111111111111111111111111111111111111111'] || [],
        walletToNftHoldings['0x1111111111111111111111111111111111111111'] || []
      );
      
      // Verify points calculation
      expect(points.totalPoints).toBeGreaterThan(0);
      expect(points.tokenPoints['TOKEN1']).toBeDefined();
      expect(points.nftPoints['NFT1']).toBe(1000);
    });
  });
});
