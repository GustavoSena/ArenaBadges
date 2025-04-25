import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import { NftHolder } from '../types/interfaces';
import { sleep } from '../utils/helpers';

// Load environment variables
dotenv.config();

// Get API key from .env
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
  console.warn('ALCHEMY_API_KEY not found in .env file. Required for fetching NFT holders.');
}

// Setup ethers provider
const rpcProvider = "https://avax-mainnet.g.alchemy.com/v2/" + ALCHEMY_API_KEY;
const provider = new ethers.JsonRpcProvider(rpcProvider);

// ERC-721 ABI (minimal for balanceOf and ownerOf functions)
const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)"
];

/**
 * Fetch NFT holders using ethers.js and Alchemy provider
 */
export async function fetchNftHoldersFromEthers(
  nftAddress: string, 
  nftName: string, 
  minNftBalance: number
): Promise<NftHolder[]> {
  try {
    console.log(`Fetching holders for ${nftName} (${nftAddress}) using ethers.js...`);
    
    // Create contract instance
    const nftContract = new ethers.Contract(nftAddress, ERC721_ABI, provider);
    
    // Track NFT holders and their token counts
    const holderCounts = new Map<string, number>();
    
    // Start checking token IDs from 0
    console.log("Checking token owners sequentially...");
    
    // Process tokens in batches to avoid rate limiting
    const batchSize = 25;
    let invalidTokenCount = 0;
    const maxInvalidTokens = 5; // Stop after encountering this many invalid tokens in a row
    
    for (let i = 0; ; i += batchSize) {
      const promises = [];
      for (let j = 0; j < batchSize; j++) {
        const tokenId = i + j;
        promises.push(
          (async () => {
            // Add retry mechanism for errors other than invalid token ID
            const MAX_RETRIES = 3;
            let retryCount = 0;
            
            while (retryCount <= MAX_RETRIES) {
              try {
                const owner = await nftContract.ownerOf(tokenId);
                return { tokenId, owner: owner.toLowerCase(), valid: true };
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isInvalidTokenId = errorMessage.includes("invalid token ID");
                
                if (isInvalidTokenId) {
                  // No need to retry for invalid token IDs
                  console.log(`Token ${tokenId}: Invalid token ID`);
                  return { tokenId, valid: false, isInvalidTokenId: true };
                } else {
                  // For other errors, retry up to MAX_RETRIES times
                  retryCount++;
                  if (retryCount <= MAX_RETRIES) {
                    console.log(`Error getting owner for token ${tokenId}: ${errorMessage}. Retry ${retryCount}/${MAX_RETRIES}...`);
                    // Add a small delay before retrying
                    await sleep(500);
                  } else {
                    console.error(`Failed after ${MAX_RETRIES} retries for token ${tokenId}: ${errorMessage}`);
                    return { tokenId, valid: false, isInvalidTokenId: false };
                  }
                }
              }
            }
            
            // This should never be reached but TypeScript needs it
            return { tokenId, valid: false, isInvalidTokenId: false };
          })()
        );
      }
      
      const results = await Promise.all(promises);
      
      // Check if we've reached the end of valid tokens
      const invalidTokens = results.filter(r => !r.valid);
      const invalidTokenIds = results.filter(r => r.isInvalidTokenId);
      
      if (invalidTokenIds.length === batchSize) {
        invalidTokenCount += invalidTokenIds.length;
        if (invalidTokenCount >= maxInvalidTokens) {
          console.log(`Found ${maxInvalidTokens} invalid token IDs in a row, assuming we've reached the end of the collection`);
          break;
        }
      } else {
        // Reset the counter if we found any valid tokens
        invalidTokenCount = 0;
      }
      
      // Update holder counts for valid tokens
      for (const result of results) {
        if (result.valid && result.owner !== '0x0000000000000000000000000000000000000000') {
          holderCounts.set(result.owner, (holderCounts.get(result.owner) || 0) + 1);
        }
      }
      
      // Log progress
      console.log(`Processed up to token ID ${i + batchSize - 1}, found ${holderCounts.size} unique holders so far`);
      
      // Add a small delay between batches to avoid rate limiting
      await sleep(200);
    }
    
    console.log(`Found ${holderCounts.size} unique holders`);
    
    // Convert to our NftHolder format
    const holders: NftHolder[] = [];
    for (const [address, tokenCount] of holderCounts.entries()) {
      if (tokenCount >= minNftBalance) {
        holders.push({
          address,
          tokenCount,
          tokenName: nftName
        });
      }
    }
    
    // Sort holders by token count (descending)
    holders.sort((a, b) => b.tokenCount - a.tokenCount);
    
    console.log(`Found ${holders.length} holders with at least ${minNftBalance} ${nftName}`);
    return holders;
  } catch (error) {
    console.error(`Error fetching NFT holders for ${nftAddress}:`, error);
    return [];
  }
}
