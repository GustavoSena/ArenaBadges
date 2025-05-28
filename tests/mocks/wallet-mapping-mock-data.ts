import { TokenHolding, NftHolding } from '../../src/types/interfaces';

/**
 * Mock wallet-to-Twitter handle mapping with various scenarios
 */
export const mockWalletMapping = {
  // User1 has 3 wallets with different token holdings
  '0x1111111111111111111111111111111111111111': 'user1',
  '0x1112222222222222222222222222222222222222': 'user1',
  '0x1113333333333333333333333333333333333333': 'user1',
  
  // User2 has 2 wallets with different NFT holdings
  '0x2221111111111111111111111111111111111111': 'user2',
  '0x2222222222222222222222222222222222222222': 'user2',
  
  // User3 has 1 wallet with both tokens and NFTs
  '0x3333333333333333333333333333333333333333': 'user3',
  
  // User4 has 2 wallets with minimal holdings
  '0x4444444444444444444444444444444444444444': 'user4',
  '0x4445555555555555555555555555555555555555': 'user4',
  
  // User5 has 1 wallet with large holdings
  '0x5555555555555555555555555555555555555555': 'user5',
  
  // User6 has 3 wallets with complementary holdings (need to be combined to qualify)
  '0x6661111111111111111111111111111111111111': 'user6',
  '0x6662222222222222222222222222222222222222': 'user6',
  '0x6663333333333333333333333333333333333333': 'user6'
};

/**
 * Mock token holdings for various wallets
 */
export const mockTokenHoldings: Record<string, TokenHolding[]> = {
  // User1's wallets
  '0x1111111111111111111111111111111111111111': [
    {
      tokenAddress: '0xtoken1',
      tokenSymbol: 'TOKEN1',
      tokenBalance: '100',
      tokenDecimals: 18,
      balanceFormatted: 100
    }
  ],
  '0x1112222222222222222222222222222222222222': [
    {
      tokenAddress: '0xtoken2',
      tokenSymbol: 'TOKEN2',
      tokenBalance: '200',
      tokenDecimals: 18,
      balanceFormatted: 200
    }
  ],
  '0x1113333333333333333333333333333333333333': [
    {
      tokenAddress: '0xtoken3',
      tokenSymbol: 'TOKEN3',
      tokenBalance: '50',
      tokenDecimals: 18,
      balanceFormatted: 50
    }
  ],
  
  // User2's wallets - only small token amounts
  '0x2221111111111111111111111111111111111111': [
    {
      tokenAddress: '0xtoken1',
      tokenSymbol: 'TOKEN1',
      tokenBalance: '5',
      tokenDecimals: 18,
      balanceFormatted: 5
    }
  ],
  '0x2222222222222222222222222222222222222222': [
    {
      tokenAddress: '0xtoken2',
      tokenSymbol: 'TOKEN2',
      tokenBalance: '10',
      tokenDecimals: 18,
      balanceFormatted: 10
    }
  ],
  
  // User3's wallet - has multiple tokens
  '0x3333333333333333333333333333333333333333': [
    {
      tokenAddress: '0xtoken1',
      tokenSymbol: 'TOKEN1',
      tokenBalance: '75',
      tokenDecimals: 18,
      balanceFormatted: 75
    },
    {
      tokenAddress: '0xtoken2',
      tokenSymbol: 'TOKEN2',
      tokenBalance: '150',
      tokenDecimals: 18,
      balanceFormatted: 150
    },
    {
      tokenAddress: '0xtoken3',
      tokenSymbol: 'TOKEN3',
      tokenBalance: '25',
      tokenDecimals: 18,
      balanceFormatted: 25
    }
  ],
  
  // User4's wallets - minimal holdings
  '0x4444444444444444444444444444444444444444': [
    {
      tokenAddress: '0xtoken1',
      tokenSymbol: 'TOKEN1',
      tokenBalance: '1',
      tokenDecimals: 18,
      balanceFormatted: 1
    }
  ],
  '0x4445555555555555555555555555555555555555': [
    {
      tokenAddress: '0xtoken2',
      tokenSymbol: 'TOKEN2',
      tokenBalance: '2',
      tokenDecimals: 18,
      balanceFormatted: 2
    }
  ],
  
  // User5's wallet - large holdings
  '0x5555555555555555555555555555555555555555': [
    {
      tokenAddress: '0xtoken1',
      tokenSymbol: 'TOKEN1',
      tokenBalance: '1000',
      tokenDecimals: 18,
      balanceFormatted: 1000
    },
    {
      tokenAddress: '0xtoken2',
      tokenSymbol: 'TOKEN2',
      tokenBalance: '2000',
      tokenDecimals: 18,
      balanceFormatted: 2000
    },
    {
      tokenAddress: '0xtoken3',
      tokenSymbol: 'TOKEN3',
      tokenBalance: '3000',
      tokenDecimals: 18,
      balanceFormatted: 3000
    }
  ],
  
  // User6's wallets - complementary holdings (need to be combined)
  '0x6661111111111111111111111111111111111111': [
    {
      tokenAddress: '0xtoken1',
      tokenSymbol: 'TOKEN1',
      tokenBalance: '30',
      tokenDecimals: 18,
      balanceFormatted: 30
    }
  ],
  '0x6662222222222222222222222222222222222222': [
    {
      tokenAddress: '0xtoken2',
      tokenSymbol: 'TOKEN2',
      tokenBalance: '40',
      tokenDecimals: 18,
      balanceFormatted: 40
    }
  ],
  '0x6663333333333333333333333333333333333333': [
    {
      tokenAddress: '0xtoken3',
      tokenSymbol: 'TOKEN3',
      tokenBalance: '30',
      tokenDecimals: 18,
      balanceFormatted: 30
    }
  ]
};

/**
 * Mock NFT holdings for various wallets
 */
export const mockNftHoldings: Record<string, NftHolding[]> = {
  // User1's wallet - has 1 NFT
  '0x1111111111111111111111111111111111111111': [
    {
      tokenAddress: '0xnft1',
      tokenSymbol: 'NFT1',
      tokenBalance: '1'
    }
  ],
  
  // User2's wallets - has multiple NFTs across wallets
  '0x2221111111111111111111111111111111111111': [
    {
      tokenAddress: '0xnft1',
      tokenSymbol: 'NFT1',
      tokenBalance: '2'
    }
  ],
  '0x2222222222222222222222222222222222222222': [
    {
      tokenAddress: '0xnft2',
      tokenSymbol: 'NFT2',
      tokenBalance: '3'
    }
  ],
  
  // User3's wallet - has multiple NFTs in one wallet
  '0x3333333333333333333333333333333333333333': [
    {
      tokenAddress: '0xnft1',
      tokenSymbol: 'NFT1',
      tokenBalance: '1'
    },
    {
      tokenAddress: '0xnft2',
      tokenSymbol: 'NFT2',
      tokenBalance: '2'
    },
    {
      tokenAddress: '0xnft3',
      tokenSymbol: 'NFT3',
      tokenBalance: '1'
    }
  ],
  
  // User5's wallet - has rare NFTs
  '0x5555555555555555555555555555555555555555': [
    {
      tokenAddress: '0xnft1',
      tokenSymbol: 'NFT1',
      tokenBalance: '5'
    },
    {
      tokenAddress: '0xnft2',
      tokenSymbol: 'NFT2',
      tokenBalance: '10'
    },
    {
      tokenAddress: '0xnft3',
      tokenSymbol: 'NFT3',
      tokenBalance: '3'
    }
  ],
  
  // User6's wallets - complementary NFT holdings
  '0x6661111111111111111111111111111111111111': [],
  '0x6662222222222222222222222222222222222222': [
    {
      tokenAddress: '0xnft1',
      tokenSymbol: 'NFT1',
      tokenBalance: '1'
    }
  ],
  '0x6663333333333333333333333333333333333333': [
    {
      tokenAddress: '0xnft2',
      tokenSymbol: 'NFT2',
      tokenBalance: '1'
    }
  ]
};

/**
 * Mock token configurations for testing different badge requirements
 */
export const mockTokenConfigs = {
  // Basic token requirements
  basic: [
    {
      address: '0xtoken1',
      symbol: 'TOKEN1',
      decimals: 18,
      minBalance: 50
    }
  ],
  
  // Upgraded token requirements
  upgraded: [
    {
      address: '0xtoken2',
      symbol: 'TOKEN2',
      decimals: 18,
      minBalance: 100
    },
    {
      address: '0xtoken3',
      symbol: 'TOKEN3',
      decimals: 18,
      minBalance: 75
    }
  ],
  
  // Premium token requirements (high thresholds)
  premium: [
    {
      address: '0xtoken1',
      symbol: 'TOKEN1',
      decimals: 18,
      minBalance: 500
    },
    {
      address: '0xtoken2',
      symbol: 'TOKEN2',
      decimals: 18,
      minBalance: 1000
    }
  ],
  
  // Combined requirements (need multiple tokens but lower amounts)
  combined: [
    {
      address: '0xtoken1',
      symbol: 'TOKEN1',
      decimals: 18,
      minBalance: 25
    },
    {
      address: '0xtoken2',
      symbol: 'TOKEN2',
      decimals: 18,
      minBalance: 25
    },
    {
      address: '0xtoken3',
      symbol: 'TOKEN3',
      decimals: 18,
      minBalance: 25
    }
  ]
};

/**
 * Mock NFT configurations for testing different badge requirements
 */
export const mockNftConfigs = {
  // Basic NFT requirements
  basic: [
    {
      address: '0xnft1',
      name: 'NFT1',
      minBalance: 1,
      collectionSize: 100
    }
  ],
  
  // Upgraded NFT requirements
  upgraded: [
    {
      address: '0xnft2',
      name: 'NFT2',
      minBalance: 2,
      collectionSize: 100
    }
  ],
  
  // Premium NFT requirements (high thresholds)
  premium: [
    {
      address: '0xnft1',
      name: 'NFT1',
      minBalance: 5,
      collectionSize: 100
    }
  ],
  
  // Combined requirements (need multiple NFTs)
  combined: [
    {
      address: '0xnft1',
      name: 'NFT1',
      minBalance: 1,
      collectionSize: 100
    },
    {
      address: '0xnft2',
      name: 'NFT2',
      minBalance: 1,
      collectionSize: 100
    }
  ]
};

/**
 * Mock badge configurations with different combinations of requirements
 */
export const mockBadgeConfigs = {
  // Only token requirements, no NFTs
  tokensOnly: {
    basic: {
      tokens: mockTokenConfigs.basic,
      nfts: []
    },
    upgraded: {
      tokens: mockTokenConfigs.upgraded,
      nfts: []
    }
  },
  
  // Only NFT requirements, no tokens
  nftsOnly: {
    basic: {
      tokens: [],
      nfts: mockNftConfigs.basic
    },
    upgraded: {
      tokens: [],
      nfts: mockNftConfigs.upgraded
    }
  },
  
  // Mixed requirements (tokens and NFTs)
  mixed: {
    basic: {
      tokens: mockTokenConfigs.basic,
      nfts: mockNftConfigs.basic
    },
    upgraded: {
      tokens: mockTokenConfigs.upgraded,
      nfts: mockNftConfigs.upgraded
    }
  },
  
  // High threshold requirements
  premium: {
    basic: {
      tokens: mockTokenConfigs.premium,
      nfts: []
    },
    upgraded: {
      tokens: [],
      nfts: mockNftConfigs.premium
    }
  },
  
  // Combined requirements (need multiple tokens/NFTs but lower amounts)
  combined: {
    basic: {
      tokens: mockTokenConfigs.combined,
      nfts: []
    },
    upgraded: {
      tokens: [],
      nfts: mockNftConfigs.combined
    }
  },
  
  // Single tier (only basic badge)
  singleTier: {
    basic: {
      tokens: mockTokenConfigs.basic,
      nfts: mockNftConfigs.basic
    }
  }
};

/**
 * Mock leaderboard configurations for testing
 */
export const mockLeaderboardConfigs = {
  // Standard leaderboard with token weights
  standard: {
    getLeaderboardTokens: () => [
      { address: '0xtoken1', symbol: 'TOKEN1', decimals: 18, minBalance: 10, weight: 1 },
      { address: '0xtoken2', symbol: 'TOKEN2', decimals: 18, minBalance: 10, weight: 2 },
      { address: '0xtoken3', symbol: 'TOKEN3', decimals: 18, minBalance: 10, weight: 3 }
    ],
    checkEligibility: () => Promise.resolve(true),
    calculatePoints: () => Promise.resolve({
      totalPoints: 350,
      tokenPoints: { 'TOKEN1': 100, 'TOKEN2': 150, 'TOKEN3': 100 },
      nftPoints: {}
    })
  },
  
  // NFT-focused leaderboard
  nftFocused: {
    getLeaderboardTokens: () => [
      { address: '0xtoken1', symbol: 'TOKEN1', decimals: 18, minBalance: 10, weight: 1 }
    ],
    checkEligibility: () => Promise.resolve(true),
    calculatePoints: () => Promise.resolve({
      totalPoints: 500,
      tokenPoints: { 'TOKEN1': 100 },
      nftPoints: { 'NFT1': 200, 'NFT2': 200 }
    })
  },
  
  // High threshold leaderboard (only top holders qualify)
  highThreshold: {
    getLeaderboardTokens: () => [
      { address: '0xtoken1', symbol: 'TOKEN1', decimals: 18, minBalance: 500, weight: 1 },
      { address: '0xtoken2', symbol: 'TOKEN2', decimals: 18, minBalance: 1000, weight: 2 }
    ],
    checkEligibility: (tokenHoldings: TokenHolding[]) => {
      // Only qualify if total balance is over 1500
      const totalBalance = tokenHoldings.reduce((sum, holding) => sum + holding.balanceFormatted, 0);
      return Promise.resolve(totalBalance >= 1500);
    },
    calculatePoints: () => Promise.resolve({
      totalPoints: 3000,
      tokenPoints: { 'TOKEN1': 1000, 'TOKEN2': 2000 },
      nftPoints: {}
    })
  }
};

/**
 * Creates a Map<string, Map<string, TokenHolding>> from the mock token holdings
 */
export function createWalletToTokenHoldingsMap(): Map<string, Map<string, TokenHolding>> {
  const walletToTokenHoldings = new Map<string, Map<string, TokenHolding>>();
  
  Object.entries(mockTokenHoldings).forEach(([address, holdings]) => {
    const tokenMap = new Map<string, TokenHolding>();
    
    holdings.forEach(holding => {
      tokenMap.set(holding.tokenAddress, holding);
    });
    
    walletToTokenHoldings.set(address, tokenMap);
  });
  
  return walletToTokenHoldings;
}

/**
 * Creates a Map<string, Map<string, NftHolding>> from the mock NFT holdings
 */
export function createWalletToNftHoldingsMap(): Map<string, Map<string, NftHolding>> {
  const walletToNftHoldings = new Map<string, Map<string, NftHolding>>();
  
  Object.entries(mockNftHoldings).forEach(([address, holdings]) => {
    const nftMap = new Map<string, NftHolding>();
    
    holdings.forEach(holding => {
      nftMap.set(holding.tokenAddress, holding);
    });
    
    walletToNftHoldings.set(address, nftMap);
  });
  
  return walletToNftHoldings;
}
