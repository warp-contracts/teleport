import { Seller } from "../clients/Seller";
//@ts-ignore
import { evmSignature } from 'warp-contracts-plugin-signature/server';
import { ethers, Signer } from "ethers";
import { WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { Buyer } from "../clients/Buyer";
import { deployNft } from "./Nft";

export const TEST_PAYMENT_TOKEN = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";

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

    const seller = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE);
    const buyer = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB)

    const { offerId } = await seller.createOffer(
        ALICE_NFT.contractTxId,
        ALICE_NFT.nftId,
        '10',
        TEST_PAYMENT_TOKEN
    );
    console.log(`Seller: Created offer ${offerId} for NFT: ${ALICE_NFT.contractTxId}:${ALICE_NFT.nftId} for price 10 paid in token ${TEST_PAYMENT_TOKEN}`)

    const { escrowId } = await buyer.acceptOffer(offerId, "password");
    console.log(`Buyer: Accepted offer ${offerId} and secured it by escrow ${escrowId}`)

    await seller.acceptEscrow(escrowId, offerId);
    console.log(`Seller: Accepted ${escrowId}`)

    await buyer.finalize(offerId, "password");
    console.log(`Buyer: Finalized offer and revealed password: password`)

    await seller.finalize(escrowId, "password")
    console.log(`Seller: Withdraw money from escrow using revealed password`)
}

main()
