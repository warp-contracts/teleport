const { hash, NFTSeller, Offer, NFT, NFTBuyer, Token, OfferState, Clock } = require('./spec');
const { it, describe, beforeEach } = require("node:test");
const assert = require('node:assert');
const { randomUUID } = require('node:crypto');

const ALICE = 'ALICE';
const BOB = 'BOB';

const getUsdt = () => new Token('USDT', { [ALICE]: 100, [BOB]: 200 })

const assertMatch = (actual, expected) => {
    for (const key of Object.keys(expected)) {
        assert.equal(actual[key], expected[key])
    }
};

/**
 * 1. SELLER post selling OFFER{price, SELLER} and lock ASSET for some period of time
 * 2. BUYER is watching OFFERS
 * 3. When he find OFFER interesting BUYER post TRADE{OFFER.SELLER, OFFER.price, hash(password)} and lock funds
 * 4. SELLER is watching TRADES
 * 5. SELLER accepts TRADE by setting OFFER.acceptTrade(TRADE) hash(password), and receiver to it, now it can be only unlocked by BUYER.
 * 6. Now buyer must trigger trade by reveling password
 */


describe('spec', () => {

    beforeEach(() => {
        Clock.s = 1;
    })

    describe('INIT', () => {
        it('should create offer', async () => {
            const seller = new NFTSeller(ALICE);
            const aliceNFT = new NFT('alice-1', ALICE);

            const offer = await seller.postOffer({ token: 'USDT', value: 10 }, aliceNFT);

            assertMatch(
                offer,
                {
                    state: OfferState.PENDING,
                    value: 10,
                    token: 'USDT',
                    nft: aliceNFT,
                    expireAt: 3601,
                    owner: ALICE
                }
            );

            // Offer contract should be now owner of asset
            assert.equal(
                await aliceNFT.ownerOf(),
                offer.contractId
            );
        });

        it('should fail to create offer if signer is not owner of nft', async () => {
            const aliceNFT = new NFT('alice-1', ALICE);

            assert.rejects(Offer.create(
                10,
                'USDT',
                aliceNFT,
                BOB
            ),
                err => {
                    assert.equal(err.message, "Only owner of nft can create offer on it")
                    return true;
                }
            )
        });

    });

    describe(OfferState.PENDING, () => {
        it('buyer should accept offer', async () => {
            const seller = new NFTSeller(ALICE);
            const aliceNFT = new NFT('alice-1', ALICE);

            const usdt = getUsdt();
            const buyer = new NFTBuyer(BOB, usdt);

            const offer = await seller.postOffer({ token: 'USDT', value: 10 }, aliceNFT);
            const password = randomUUID();
            const escrow = await buyer.acceptOffer(offer, password);

            assertMatch(
                escrow,
                {
                    expireAt: Clock.s + 3600,
                    receiver: offer.owner,
                    hashedPassword: hash(password),
                    amount: 10,
                    owner: BOB
                }
            )

            assert.equal(
                usdt.balances[BOB],
                200 - 10
            )

            assert.equal(
                usdt.balances[escrow.contractId],
                10
            )

            assertMatch(
                offer,
                {
                    state: OfferState.ACCEPTED_BY_BUYER,
                    value: 10,
                    token: 'USDT',
                    nft: aliceNFT,
                    expireAt: 3601,
                    owner: ALICE,
                    hashedPassword: hash(password),
                    buyer: buyer.signer
                }
            );
        });
    })

    // should validate if ContractSrcTxId is some const


    it('seller should accept offer', async () => {
        const seller = new NFTSeller(ALICE);
        const aliceNFT = new NFT('alice-1', ALICE);

        const usdt = getUsdt();
        const buyer = new NFTBuyer(BOB, usdt);

        const offer = await seller.postOffer({ token: 'USDT', value: 10 }, aliceNFT);
        const password = randomUUID();
        const escrow = await buyer.acceptOffer(offer, password);

        await seller.acceptOffer(offer, escrow);

        assertMatch(
            offer,
            {
                state: OfferState.ACCEPTED_BY_SELLER,
                value: 10,
                token: 'USDT',
                nft: aliceNFT,
                expireAt: 3601,
                owner: ALICE,
                hashedPassword: hash(password),
                buyer: buyer.signer
            }
        )
    });

    it('buyer should withdraw NFT', async () => {
        const seller = new NFTSeller(ALICE);
        const aliceNFT = new NFT('alice-1', ALICE);

        const usdt = getUsdt();
        const buyer = new NFTBuyer(BOB, usdt);

        const offer = await seller.postOffer({ token: 'USDT', value: 10 }, aliceNFT);
        const password = randomUUID();
        const escrow = await buyer.acceptOffer(offer, password);

        await seller.acceptOffer(offer, escrow);
        await buyer.consumeOffer(offer, password);
        await seller.consumeEscrow(escrow, password);

        assert.equal(
            aliceNFT.owner,
            buyer.signer
        );

        assert.equal(
            usdt.balances[ALICE],
            100 + 10
        )

        assert.equal(
            usdt.balances[escrow.contractId],
            0
        )

        assert.equal(
            usdt.balances[BOB],
            200 - 10
        )
    });


});