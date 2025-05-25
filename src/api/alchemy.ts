import { Alchemy, Network } from "alchemy-sdk";

let alchemy: Alchemy;

export function setupAlchemy(apiKey: string) {
    const config = {
        apiKey: apiKey,
        network: Network.AVAX_MAINNET,
    };
    alchemy = new Alchemy(config);
}

export async function getOwnersForContract(address: string) {
    if (!alchemy) {
        throw new Error("Alchemy not initialized");
    }
    const owners = await alchemy.nft.getOwnersForContract(address);
    return owners;
}

export async function getNFTsforWallet(walletAddress: string, nftAddresses: string[]) {
    if (!alchemy) {
        throw new Error("Alchemy not initialized");
    }
    const nfts = await alchemy.nft.getNftsForOwner(walletAddress, {contractAddresses: nftAddresses});
    return nfts;
}

export async function getTokensBalance(walletAddress: string, tokenAddresses: string[]) {
    if (!alchemy) {
        throw new Error("Alchemy not initialized");
    }
    const balance = await alchemy.core.getTokenBalances(walletAddress, tokenAddresses);
    return balance;
}
    