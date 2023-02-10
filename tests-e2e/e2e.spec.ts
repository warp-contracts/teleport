import { Seller } from "../client/Seller";
//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { ethers, Signer } from "ethers";
import { LoggerFactory, WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { Buyer } from "../client/Buyer";
import { deployNft } from "./nft";
import { describe, it } from 'node:test';
import assert from 'node:assert';


const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })
const evmProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
const ALICE = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
const BOB = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
const ESCROW_FACTORY_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const OFFER_SRC_TX_ID = "bqLDy8-ZBgoEtnMQN68-rtjuYk00nAOlQPffczYKSIw";
export const TEST_PAYMENT_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
LoggerFactory.INST.logLevel('none');


describe('e2e tests', () => {

    it('Succeed', async () => {
        const erc20 = new ethers.Contract(TEST_PAYMENT_TOKEN, ERC20_ABI, evmProvider);
        const aliceStartBalance = (await erc20.balanceOf(ALICE.address)).toNumber();

        const warp = WarpFactory
            .forMainnet({ inMemory: true, dbLocation: '' })
            .use(new EthersExtension());

        const ALICE_NFT = await deployNft(warp, ALICE);

        const seller = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE.connect(evmProvider), OFFER_SRC_TX_ID);
        const buyer = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB.connect(evmProvider), OFFER_SRC_TX_ID, ESCROW_FACTORY_ADDRESS)

        const price = '10';
        const { offerId } = await seller.createOffer(
            ALICE_NFT.contractTxId,
            price,
            TEST_PAYMENT_TOKEN
        );

        const { escrowId } = await buyer.acceptOffer(offerId, "password");

        await seller.acceptEscrow(escrowId, offerId);
        await buyer.finalize(offerId, "password");

        await seller.finalize(escrowId, offerId);

        const { cachedValue: { state: { owner: ownerAfter } } } = await ALICE_NFT.nftContract.readState();

        assert.equal(ownerAfter, BOB.address);
        const aliceEndBalance = (await erc20.balanceOf(ALICE.address)).toNumber();
        assert.equal(aliceEndBalance - aliceStartBalance, Number(price));
    });

    it('Fail to create two offers for same NFT', async () => {
        const evmProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

        const warp = WarpFactory
            .forMainnet({ inMemory: true, dbLocation: '' })
            .use(new EthersExtension());

        const NFT_A = await deployNft(warp, ALICE);

        const seller = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE.connect(evmProvider), OFFER_SRC_TX_ID);

        await seller.createOffer(NFT_A.contractTxId, '1', TEST_PAYMENT_TOKEN);

        assert.rejects(seller.createOffer(NFT_A.contractTxId, '1', TEST_PAYMENT_TOKEN),
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

            const ALICE_NFT = await deployNft(warp, ALICE);
            const BOB_NFT = await deployNft(warp, BOB);

            const sellerAlice = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE.connect(evmProvider), OFFER_SRC_TX_ID);
            const sellerBob = new Seller(makeWarpEvmSigner(BOB), warp, evmProvider, BOB.connect(evmProvider), OFFER_SRC_TX_ID);
            const buyer = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB.connect(evmProvider), OFFER_SRC_TX_ID, ESCROW_FACTORY_ADDRESS)

            const price = '10';
            const offerAlice = await sellerAlice.createOffer(
                ALICE_NFT.contractTxId,
                price,
                TEST_PAYMENT_TOKEN
            );
            const offerBob = await sellerBob.createOffer(
                BOB_NFT.contractTxId,
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


    it('One offer two escrows, only one should win, second should be rejected', async () => {
        const warp = WarpFactory
            .forMainnet({ inMemory: true, dbLocation: '' })
            .use(new EthersExtension());

        const ALICE_NFT = await deployNft(warp, ALICE);

        const sellerAlice = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE.connect(evmProvider), OFFER_SRC_TX_ID);
        const buyerAlice = new Buyer(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE.connect(evmProvider), OFFER_SRC_TX_ID, ESCROW_FACTORY_ADDRESS);
        const buyerBob = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB.connect(evmProvider), OFFER_SRC_TX_ID, ESCROW_FACTORY_ADDRESS)

        const price = '10';
        const offerAlice = await sellerAlice.createOffer(
            ALICE_NFT.contractTxId,
            price,
            TEST_PAYMENT_TOKEN,
            undefined,
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' // with delegate
        );

        await buyerAlice.acceptOffer(offerAlice.offerId, "qwe");

        const { escrowId: escrowIdAlice } = await buyerAlice.acceptOffer(offerAlice.offerId, "qwe2");
        const { escrowId: escrowIdBob } = await buyerBob.acceptOffer(offerAlice.offerId, "qwe2");

        await sellerAlice.acceptEscrow(escrowIdAlice, offerAlice.offerId);
        await assert.rejects(
            sellerAlice.acceptEscrow(escrowIdBob, offerAlice.offerId),
            (err: any) => {
                assert.equal(err.message, 'Contract evaluation failed: Offer to be accepted by seller has to be in stage PENDING')
                return true;
            }
        )
    });
});
