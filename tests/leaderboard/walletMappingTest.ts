/*import { combineTokenHoldersByHandle } from '../../src/leaderboard/utils/leaderboardUtils';
import fs from 'fs';
import path from 'path';

// Mock the fetchArenabookSocial function
jest.mock('../../src/api/arenabook', () => ({
  fetchArenabookSocial: jest.fn().mockImplementation(async (address: string) => {
    // Return mock social profiles for specific addresses
    const mockProfiles: Record<string, { twitter_handle: string }> = {
      '0x3db5fee67803e78485aed1733a7f07a700e11181': { twitter_handle: 'fathersenax' },
      '0xbe1a02b7a5e31ae10fedc0804f053da0d2a80053': { twitter_handle: 'el33th4xor' },
      // Add more mock profiles as needed
    };
    
    return mockProfiles[address.toLowerCase()] || null;
  })
}));

describe('Wallet Mapping Tests', () => {
  // Test data
  const tokenHolders = [
    {
      address: '0xC6EaB1b834647bbDc18f42d33a791Fb1FAC73e58',
      balance: '1000000000000000000', // 1 token
      balanceFormatted: 1,
      tokenSymbol: 'MUG'
    },
    {
      address: '0x3db5fee67803e78485aed1733a7f07a700e11181',
      balance: '2000000000000000000', // 2 tokens
      balanceFormatted: 2,
      tokenSymbol: 'MUG'
    },
    {
      address: '0x6445FD8ae37E58ea57eE8f1DA824354B69f9abDC',
      balance: '3000000000000000000', // 3 tokens
      balanceFormatted: 3,
      tokenSymbol: 'MUG'
    },
    {
      address: '0x1e4240001ed8eC6705887332e1fD18b98f0C1e4F',
      balance: '4000000000000000000', // 4 tokens
      balanceFormatted: 4,
      tokenSymbol: 'MUG'
    },
    {
      address: '0xbe1a02b7a5E31aE10fEdC0804f053Da0D2a80053',
      balance: '5000000000000000000', // 5 tokens
      balanceFormatted: 5,
      tokenSymbol: 'MUG'
    },
    {
      address: '0xRandomAddress1',
      balance: '500000000000000000', // 0.5 tokens
      balanceFormatted: 0.5,
      tokenSymbol: 'MUG'
    },
    {
      address: '0xRandomAddress2',
      balance: '700000000000000000', // 0.7 tokens
      balanceFormatted: 0.7,
      tokenSymbol: 'MUG'
    }
  ];

  // Load wallet mapping from the config file
  const loadWalletMapping = () => {
    const mappingPath = path.join(process.cwd(), 'config/mappings/mu_wallet_mapping.json');
    if (!fs.existsSync(mappingPath)) {
      throw new Error(`Wallet mapping file not found: ${mappingPath}`);
    }
    return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  };

  // Create handle to wallet mapping
  const getHandleToWalletMapping = (walletMapping: Record<string, string>) => {
    const handleToWallet: Record<string, string> = {};
    for (const [wallet, handle] of Object.entries(walletMapping)) {
      handleToWallet[handle.toLowerCase()] = wallet.toLowerCase();
    }
    return handleToWallet;
  };

  test('Should combine token holders based on wallet mapping', async () => {
    // Load wallet mapping
    const walletMapping = loadWalletMapping();
    const handleToWallet = getHandleToWalletMapping(walletMapping);
    
    // Maps to store Twitter handles and combined addresses
    const addressToTwitterHandle = new Map<string, string>();
    const addressToCombinedAddresses = new Map<string, string[]>();
    
    // Combine token holders
    const combinedHolders = await combineTokenHoldersByHandle(
      tokenHolders,
      walletMapping,
      true, // sumOfBalances
      addressToTwitterHandle,
      addressToCombinedAddresses
    );
    
    // Log the combined holders for debugging
    console.log('Combined token holders:');
    combinedHolders.forEach(holder => {
      console.log(`  ${holder.address} (${holder.balanceFormatted} ${holder.tokenSymbol})`);
    });
    
    // Log the address to Twitter handle mapping
    console.log('\nAddress to Twitter handle mapping:');
    addressToTwitterHandle.forEach((handle, address) => {
      console.log(`  ${address} -> ${handle}`);
    });
    
    // Log the combined addresses
    console.log('\nCombined addresses:');
    addressToCombinedAddresses.forEach((addresses, representativeAddress) => {
      console.log(`  ${representativeAddress} represents: ${addresses.join(', ')}`);
    });
    
    // Verify that FatherSenaX's wallets are combined
    const fatherSenaXHolder = combinedHolders.find(holder => 
      holder.address.toLowerCase() === '0xc6eab1b834647bbdc18f42d33a791fb1fac73e58' ||
      holder.address.toLowerCase() === '0x3db5fee67803e78485aed1733a7f07a700e11181'
    );
    
    expect(fatherSenaXHolder).toBeDefined();
    if (fatherSenaXHolder) {
      // The combined balance should be 3 (1 + 2)
      expect(fatherSenaXHolder.balanceFormatted).toBe(3);
    }
    
    // Verify that other mapped wallets are also combined correctly
    // itsCrypTech should have 3 tokens
    const cryptechHolder = combinedHolders.find(holder => 
      holder.address.toLowerCase() === '0x6445fd8ae37e58ea57ee8f1da824354b69f9abdc'
    );
    expect(cryptechHolder).toBeDefined();
    if (cryptechHolder) {
      expect(cryptechHolder.balanceFormatted).toBe(3);
    }
    
    // super8437 should have 4 tokens
    const super8437Holder = combinedHolders.find(holder => 
      holder.address.toLowerCase() === '0x1e4240001ed8ec6705887332e1fd18b98f0c1e4f'
    );
    expect(super8437Holder).toBeDefined();
    if (super8437Holder) {
      expect(super8437Holder.balanceFormatted).toBe(4);
    }
    
    // el33th4xor should have 5 tokens
    const el33th4xorHolder = combinedHolders.find(holder => 
      holder.address.toLowerCase() === '0xbe1a02b7a5e31ae10fedc0804f053da0d2a80053'
    );
    expect(el33th4xorHolder).toBeDefined();
    if (el33th4xorHolder) {
      expect(el33th4xorHolder.balanceFormatted).toBe(5);
    }
    
    // Random addresses should remain unchanged
    const randomHolder1 = combinedHolders.find(holder => 
      holder.address.toLowerCase() === '0xrandomaddress1'
    );
    expect(randomHolder1).toBeDefined();
    if (randomHolder1) {
      expect(randomHolder1.balanceFormatted).toBe(0.5);
    }
    
    const randomHolder2 = combinedHolders.find(holder => 
      holder.address.toLowerCase() === '0xrandomaddress2'
    );
    expect(randomHolder2).toBeDefined();
    if (randomHolder2) {
      expect(randomHolder2.balanceFormatted).toBe(0.7);
    }
  });
});
*/