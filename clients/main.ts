import { Seller } from "./Seller";
//@ts-ignore
import { evmSignature } from 'warp-contracts-plugin-signature/server';
import { ethers, Signer } from "ethers";
import { WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { Buyer } from "./Buyer";
import { deployNft } from "./Nft";

const TEST_PAYMENT_TOKEN = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: evmSignature(ethersSigner), type: 'ethereum' as const })

async function main() {
    // set-up
    const ALICE = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    const BOB = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
    const evmProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

    const warp = WarpFactory
        .forMainnet()
        .use(new EthersExtension());

    const ALICE_NFT = await deployNft(warp, makeWarpEvmSigner(ALICE));
    // end of set-up


    const seller = new Seller(makeWarpEvmSigner(ALICE), warp);
    const buyer = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB)

    const { offerId } = await seller.createOffer(
        ALICE_NFT.contractTxId,
        ALICE_NFT.nftId,
        '10',
        TEST_PAYMENT_TOKEN
    );

    await buyer.acceptOffer(offerId, "123");
}

main()
