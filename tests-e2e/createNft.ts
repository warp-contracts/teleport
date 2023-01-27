//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { ethers, Signer } from "ethers";
import { WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { deployNft } from "./Nft";

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })

async function main() {
    // set-up
    const ALICE = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    const BOB = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")

    const warp = WarpFactory
        .forMainnet()
        .use(new EthersExtension());

    const ALICE_NFT = await deployNft(warp, makeWarpEvmSigner(BOB));
    console.log(
        {
            nftId: ALICE_NFT.nftId,
            contractId: ALICE_NFT.contractTxId,
            owner: BOB.address
        })
}

main()
