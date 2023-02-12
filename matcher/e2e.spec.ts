import { Seller } from "../client/Seller";
//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { ethers, Signer } from "ethers";
import { LoggerFactory, WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { Buyer } from "../client/Buyer";
import { deployNft } from "../tests-e2e/nft";
import { describe, it, } from 'node:test';
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
const MATCHER_ADDRESS = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const ESCROW_FACTORY_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const OFFER_SRC_TX_ID = "bqLDy8-ZBgoEtnMQN68-rtjuYk00nAOlQPffczYKSIw";
export const TEST_PAYMENT_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";


LoggerFactory.INST.logLevel('none');



describe('e2e tests', () => {


    it('With matcher for seller', async () => {
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
            TEST_PAYMENT_TOKEN,
            undefined,
            MATCHER_ADDRESS // with delegate
        );

        const { escrowId } = await buyer.acceptOffer(offerId, "password");
        // send request to matcher {offerId, password}

        // await seller.acceptEscrow(escrowId, offerId);
        // Wait five seconds for matcher
        await new Promise((resolve, reject) => setTimeout(resolve, 5_000));

        await buyer.finalize(offerId, "password");

        // await seller.finalize(escrowId, offerId);
        await new Promise((resolve, reject) => setTimeout(resolve, 5_000));

        const { cachedValue: { state: { owner: ownerAfter } } } = await ALICE_NFT.nftContract.readState();

        assert.equal(ownerAfter, BOB.address);
        const aliceEndBalance = (await erc20.balanceOf(ALICE.address)).toNumber();
        assert.equal(aliceEndBalance - aliceStartBalance, Number(price));
    });

    it('With matcher for buyer', async () => {
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
            TEST_PAYMENT_TOKEN,
        );

        const { escrowId } = await buyer.acceptOffer(offerId, "password", { url: "http://127.0.0.1:8989" });
        // send request to matcher {offerId, password}

        await seller.acceptEscrow(escrowId, offerId);
        // Wait five seconds for matcher
        await new Promise((resolve, reject) => setTimeout(resolve, 5_000));

        await seller.finalize(escrowId, offerId);

        const { cachedValue: { state: { owner: ownerAfter } } } = await ALICE_NFT.nftContract.readState();

        assert.equal(ownerAfter, BOB.address);
        const aliceEndBalance = (await erc20.balanceOf(ALICE.address)).toNumber();
        assert.equal(aliceEndBalance - aliceStartBalance, Number(price));
    });

    it('With matcher for buyer and seller', async () => {
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
            TEST_PAYMENT_TOKEN,
            undefined,
            MATCHER_ADDRESS // with delegate
        );

        const { escrowId } = await buyer.acceptOffer(offerId, "password", { url: "http://127.0.0.1:8989" });

        // Wait five seconds for matcher
        await new Promise((resolve, reject) => setTimeout(resolve, 20_000));

        const { cachedValue: { state: { owner: ownerAfter } } } = await ALICE_NFT.nftContract.readState();
        assert.equal(ownerAfter, BOB.address);
        const aliceEndBalance = (await erc20.balanceOf(ALICE.address)).toNumber();
        assert.equal(aliceEndBalance - aliceStartBalance, Number(price));
    });

});
