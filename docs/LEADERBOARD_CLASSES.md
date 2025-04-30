# Leaderboard Class System Documentation

This document explains the class-based leaderboard system implemented in the MuBadges project, which allows for flexible and extensible point calculation logic for different leaderboard implementations.

## Overview

The leaderboard class system provides an object-oriented approach to generating leaderboards with different point calculation rules. It consists of:

1. A base abstract class (`BaseLeaderboard`) that defines the common structure and functionality
2. Specific implementations (like `MuLeaderboard`) that define custom point calculation logic
3. Support services to handle the data flow and generation process

This design allows for easy creation of new leaderboard types with different point calculation rules without modifying the core leaderboard generation process.

## Class Hierarchy

```
BaseLeaderboard (abstract)
└── MuLeaderboard
```

## Base Leaderboard Class

The `BaseLeaderboard` abstract class defines the common structure and functionality for all leaderboard implementations:

- **Properties**:
  - `config`: The leaderboard configuration
  - `provider`: The ethers provider for blockchain interactions

- **Abstract Methods**:
  - `calculateTokenPoints`: Calculate points for a token holder
  - `calculateNftPoints`: Calculate points for an NFT holder

- **Concrete Methods**:
  - `generateLeaderboard`: Generate a leaderboard from holder points

## MU Leaderboard Implementation

The `MuLeaderboard` class extends `BaseLeaderboard` and implements the specific point calculation logic for the MU community:

- **Properties**:
  - `priceProviderContract`: Contract instance for retrieving MUG/MU price
  - `mugMuPrice`: Cached MUG/MU price value

- **Methods**:
  - `getMugMuPrice`: Retrieve the MUG/MU price from the contract
  - `calculateTokenPoints`: Calculate points for tokens with the following rules:
    - MU: 2 points per token
    - MUG: Points equal to the MUG/MU price
    - MUO: 1.1x the MUG/MU price
    - MUV: 10x the MUO price (or 11x the MUG/MU price)
  - `calculateNftPoints`: Calculate points for NFTs with the following rules:
    - Mu Pups: 10x the MUG/MU price per NFT
    - Other NFTs: 100 points per NFT

## Price Provider Contract

The system interacts with a price provider contract at address `0x06bC5F1C59a971cDff30431B100ae69f416115a2` that provides the current MUG/MU price through the `getMugMuPrice()` method. This price is used as a base for calculating points for various tokens.

## Leaderboard Generation Process

1. **Initialization**:
   - Load leaderboard configuration
   - Create a leaderboard implementation instance (e.g., `MuLeaderboard`)
   - Initialize blockchain provider and contracts

2. **Data Collection**:
   - Fetch NFT holders using ethers.js
   - Retrieve social profiles for those holders
   - Filter to holders with social profiles
   - Fetch token balances for eligible addresses

3. **Point Calculation**:
   - Calculate NFT points using the implementation's `calculateNftPoints` method
   - Calculate token points using the implementation's `calculateTokenPoints` method
   - Sum up the total points for each holder

4. **Leaderboard Generation**:
   - Sort holders by total points
   - Generate leaderboard entries with rankings
   - Save the leaderboard to JSON and HTML files

## Creating a New Leaderboard Implementation

To create a new leaderboard implementation with different point calculation rules:

1. Create a new class that extends `BaseLeaderboard`
2. Implement the abstract methods:
   - `calculateTokenPoints`
   - `calculateNftPoints`
3. Add any additional properties or methods specific to your implementation
4. Create a service function to use your new implementation

Example:

```typescript
export class CustomLeaderboard extends BaseLeaderboard {
  async calculateTokenPoints(holder: TokenHolder, tokenSymbol: string): Promise<number> {
    // Your custom point calculation logic
    return holder.balanceFormatted * 5; // Example: 5 points per token
  }
  
  async calculateNftPoints(holder: NftHolder): Promise<number> {
    // Your custom NFT point calculation logic
    return holder.tokenCount * 200; // Example: 200 points per NFT
  }
}
```

## Running the MU Leaderboard

To generate the MU leaderboard with the custom point calculation rules:

```bash
npm run mu-leaderboard
```

This will:
1. Create a JSON file at `files/leaderboard.json`
2. Create an HTML file at `files/leaderboard.html`

## Technical Implementation

The leaderboard class system is implemented in the following files:

- `src/types/leaderboardClasses.ts`: Contains the base class and implementations
- `src/services/leaderboardClassService.ts`: Service functions for the class-based approach
- `src/generateMuLeaderboard.ts`: Entry point for generating the MU leaderboard

## Integration with Moralis API Key Rotation

The leaderboard class system is fully compatible with the Moralis API key rotation feature. When fetching token holders or balances using Moralis, the system will automatically rotate between multiple API keys if one reaches its quota limit.

## Future Enhancements

Potential enhancements for the leaderboard class system:

- **Additional Implementations**: Create more leaderboard implementations with different point calculation rules
- **Dynamic Configuration**: Allow point calculation rules to be defined in configuration files
- **Historical Tracking**: Track changes in rankings over time
- **Caching**: Cache contract calls and blockchain data to improve performance
- **Customizable HTML Templates**: Allow different HTML templates for different leaderboard implementations
