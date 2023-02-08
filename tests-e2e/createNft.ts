import { ethers } from "ethers";
import { WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { deployNft } from './nft';

async function main() {
    // set-up
    const ALICE = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    const BOB = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")

    const warp = WarpFactory
        .forMainnet()
        .use(new EthersExtension());

    const result = await deployNft(warp, BOB);

    console.log(
        {
            contractId: result.contractTxId,
            owner: BOB.address,
        }
    )
}

main()
