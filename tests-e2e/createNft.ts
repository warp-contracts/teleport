import { ethers } from "ethers";
import { WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { deployNft } from './nft';

async function main() {
    // set-up
    const ALICE = new ethers.Wallet("0x5e4c867f616534db8ca948f86d02462a153146766c2c9077c07f183b9315eaa5")
    const BOB = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")

    const warp = WarpFactory
        .forMainnet()
        .use(new EthersExtension());

    const result1 = await deployNft(warp, BOB);
    const result2 = await deployNft(warp, ALICE);

    console.log(
        {
            contractId: result1.contractTxId,
            owner: BOB.address,
        },
        {
            contractId: result2.contractTxId,
            owner: ALICE.address,
        }
    )
}

main()
