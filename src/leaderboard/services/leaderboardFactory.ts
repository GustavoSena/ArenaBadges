import { BaseLeaderboard, LeaderboardConfig } from "../../types/leaderboard";
import { StandardLeaderboard } from "../implementations/standardLeaderboard";
import { MuLeaderboard } from "../implementations/muLeaderboard";
import { ethers } from "ethers";



// Define leaderboard types
export enum LeaderboardType {
    STANDARD = 'standard',
    MU = 'mu'
  }



export function createLeaderboard(provider: ethers.JsonRpcProvider, leaderboardConfig: LeaderboardConfig, name: string): BaseLeaderboard {
    switch (name) {
        case LeaderboardType.STANDARD:
            return new StandardLeaderboard(provider, leaderboardConfig);
        case LeaderboardType.MU:
            return new MuLeaderboard(provider, leaderboardConfig);
        default:
            throw new Error(`Unknown leaderboard type: ${name}`);
    }
}
    
