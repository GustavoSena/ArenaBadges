import { BaseLeaderboard } from "../../types/leaderboard";
import { StandardLeaderboard } from "../implementations/standardLeaderboard";
import { MuLeaderboard } from "../implementations/muLeaderboard";
import { ethers } from "ethers";



// Define leaderboard types
export enum LeaderboardType {
    STANDARD = 'standard',
    MU = 'mu'
  }



export function createLeaderboard(provider: ethers.JsonRpcProvider, excludedAccounts: string[], name: string): BaseLeaderboard {
    switch (name) {
        case LeaderboardType.STANDARD:
            return new StandardLeaderboard(provider, excludedAccounts);
        case LeaderboardType.MU:
            return new MuLeaderboard(provider, excludedAccounts);
        default:
            throw new Error(`Unknown leaderboard type: ${name}`);
    }
}
    
