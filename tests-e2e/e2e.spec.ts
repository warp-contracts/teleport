import { Seller } from "../clients/Seller";
//@ts-ignore
import { evmSignature } from 'warp-contracts-plugin-signature/server';
import { ethers, Signer } from "ethers";
import { WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { Buyer } from "../clients/Buyer";
import { deployNft } from "./Nft";
import { describe, it } from 'node:test';
import assert from 'node:assert';

export const TEST_PAYMENT_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: evmSignature(ethersSigner), type: 'ethereum' as const })
const evmProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
const ALICE = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
const BOB = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")

describe('e2e tests', () => {

    it('Succeed', async () => {
        const erc20 = new ethers.Contract(TEST_PAYMENT_TOKEN, ERC20_ABI, evmProvider);
        const aliceStartBalance = (await erc20.balanceOf(ALICE.address)).toNumber();

        const warp = WarpFactory
            .forMainnet({ inMemory: true, dbLocation: '' })
            .use(new EthersExtension());

        const ALICE_NFT = await deployNft(warp, makeWarpEvmSigner(ALICE));
        await ALICE_NFT.nftContract.viewState({ function: 'ownerOf', tokenId: ALICE_NFT.nftId })

        const seller = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE);
        const buyer = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB)

        const price = '10';
        const { offerId } = await seller.createOffer(
            ALICE_NFT.contractTxId,
            ALICE_NFT.nftId,
            price,
            TEST_PAYMENT_TOKEN
        );

        const { escrowId } = await buyer.acceptOffer(offerId, "password");

        await seller.acceptEscrow(escrowId, offerId); // mozna zautomatyzowac

        await buyer.finalize(offerId, "password");

        await seller.finalize(escrowId, "password")

        const { result: ownerAfter } = await ALICE_NFT.nftContract.viewState({ function: 'ownerOf', tokenId: ALICE_NFT.nftId })

        assert.equal(ownerAfter, BOB.address);
        const aliceEndBalance = (await erc20.balanceOf(ALICE.address)).toNumber();
        assert.equal(aliceEndBalance - aliceStartBalance, Number(price));
    });

    it('Fail to create two offers for same NFT', async () => {
        const ALICE = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

        const evmProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

        const warp = WarpFactory
            .forMainnet({ inMemory: true, dbLocation: '' })
            .use(new EthersExtension());

        const NFT_A = await deployNft(warp, makeWarpEvmSigner(ALICE));

        const seller = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE);

        await seller.createOffer(NFT_A.contractTxId, NFT_A.nftId, '1', TEST_PAYMENT_TOKEN);

        assert.rejects(seller.createOffer(NFT_A.contractTxId, NFT_A.nftId, '1', TEST_PAYMENT_TOKEN),
            (err: any) => {
                assert.equal(err.message, "Cannot create interaction: Offer contract is not owner of NFT: 1")
                return true;
            });
    })

    describe('Two offers from two receivers, one escrow', () => {
        it('Should fail on second offer, cause of wrong offerHashId', async () => {
            const warp = WarpFactory
                .forMainnet({ inMemory: true, dbLocation: '' })
                .use(new EthersExtension());

            const ALICE_NFT = await deployNft(warp, makeWarpEvmSigner(ALICE));
            const BOB_NFT = await deployNft(warp, makeWarpEvmSigner(BOB));

            const sellerAlice = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE);
            const sellerBob = new Seller(makeWarpEvmSigner(BOB), warp, evmProvider, BOB);
            const buyer = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB)

            const price = '10';
            const offerAlice = await sellerAlice.createOffer(
                ALICE_NFT.contractTxId,
                ALICE_NFT.nftId,
                price,
                TEST_PAYMENT_TOKEN
            );
            const offerBob = await sellerBob.createOffer(
                BOB_NFT.contractTxId,
                BOB_NFT.nftId,
                price,
                TEST_PAYMENT_TOKEN
            );

            const { escrowId } = await buyer.acceptOffer(offerAlice.offerId, "qwe");

            await sellerAlice.acceptEscrow(escrowId, offerAlice.offerId);

            await assert.rejects(
                sellerBob.acceptEscrow(escrowId, offerBob.offerId),
                (err: any) => {
                    assert.equal(err.message, 'Escrow was not created for this offer')
                    return true;
                }
            );

        });
    })


    it('One offer two escrows, first should win, second should be rejected', async () => {
        const warp = WarpFactory
            .forMainnet({ inMemory: true, dbLocation: '' })
            .use(new EthersExtension());

        const ALICE_NFT = await deployNft(warp, makeWarpEvmSigner(ALICE));

        const sellerAlice = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE);
        const buyerAlice = new Buyer(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE);
        const buyerBob = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB)

        const price = '10';
        const offerAlice = await sellerAlice.createOffer(
            ALICE_NFT.contractTxId,
            ALICE_NFT.nftId,
            price,
            TEST_PAYMENT_TOKEN
        );

        await buyerAlice.acceptOffer(offerAlice.offerId, "qwe");

        await assert.rejects(
            buyerBob.acceptOffer(offerAlice.offerId, "qwe2"),
            (err: any) => {
                assert.equal(err.message, 'Wrong offer stage: ACCEPTED_BY_BUYER')
                return true;
            }
        );
    })

});
