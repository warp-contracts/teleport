import assert from 'assert';
import { readFileSync, } from 'fs';
import { LoggerFactory, WarpFactory } from 'warp-contracts';
import { join } from 'path';
import { describe, it, before, after } from 'node:test';
import Arl from 'arlocal';

const CONTRACT_PATH_OFFER = join("warp-contracts", "offer.warp.js");
const CONTRACT_PATH_NFT = join("warp-contracts", "nft.warp.js");
const warp = WarpFactory.forLocal(1411);
const CONTRACT_CODE_OFFER = readFileSync(CONTRACT_PATH_OFFER).toString();
const CONTRACT_CODE_NFT = readFileSync(CONTRACT_PATH_NFT).toString();
LoggerFactory.INST.logLevel('none');

async function deployContract(initState) {
    const { jwk: signer, address: signerAddress } = await warp.generateWallet();

    const { contractTxId } = await warp.deploy({
        wallet: signer,
        initState: initState ?? JSON.stringify({}),
        src: CONTRACT_CODE_OFFER,
    });

    const contract = warp.contract(contractTxId)
        .setEvaluationOptions({
            internalWrites: true,
        })
        .connect(signer);

    return { contract, signer, signerAddress, warp };
}

async function deployNft(initState, signer) {
    const { contractTxId } = await warp.deploy({
        wallet: signer,
        initState: initState ?? JSON.stringify({}),
        src: CONTRACT_CODE_NFT,
    });

    const contract = warp.contract(contractTxId)
        .setEvaluationOptions({
            internalWrites: true,
        })
        .connect(signer);

    return { contract, signer, warp };
}

describe('Offer', () => {
    let arlocal;

    before(async () => {
        arlocal = new Arl.default(1411, false);

        await arlocal.start();
    });

    after(async () => {
        await arlocal.stop();
    });

    it('should deploy contract', async () => {
        const { contract } = await deployContract();
        assert.ok(contract);
    });

    const createOffer = async (expirePeriod) => {
        const { contract, signer, signerAddress } = await deployContract();
        const { contract: nft } = await deployNft(JSON.stringify({ 'a': { content: 'a', owner: signerAddress } }), signer);

        await nft.writeInteraction({
            function: 'transfer', tokenId: 'a', to: contract._contractTxId,
        });

        await contract.writeInteraction(
            {
                function: 'create',
                nftContractId: nft._contractTxId,
                nftId: 'a',
                price: '5',
                priceTokenId: '12',
                expirePeriod: expirePeriod ?? 3600,
            },
            { strict: true }
        );

        return { offer: contract, nft, signer, signerAddress }
    }


    describe('create', () => {
        it('should fail to create offer if INIT_STATE != {}', async () => {
            const { contract } = await deployContract(JSON.stringify({ a: 'b' }));
            await assert.rejects(contract.writeInteraction(
                { function: 'create' },
                { strict: true }
            ), err => {
                assert.equal(err.message, "Cannot create interaction: Can't create offer if InitialState !== {}")
                return true;
            })
        });

        it(`should create offer`, async () => {
            const { contract, signer, signerAddress } = await deployContract();
            const { contract: nft } = await deployNft(JSON.stringify({ 'a': { content: 'a', owner: signerAddress } }), signer);

            await nft.writeInteraction({
                function: 'transfer', tokenId: 'a', to: contract._contractTxId
            });

            await contract.writeInteraction(
                {
                    function: 'create',
                    nftContractId: nft._contractTxId,
                    nftId: 'a',
                    price: '5',
                    priceTokenId: '12',
                    expirePeriod: 3600,
                },
                { strict: true }
            );
        });

        it(`should fail to create offer, if contract is not owner`, async () => {
            const { contract, signer, signerAddress } = await deployContract();
            const { contract: nft } = await deployNft(JSON.stringify({ 'a': { content: 'a', owner: signerAddress } }), signer);


            await assert.rejects(contract.writeInteraction(
                {
                    function: 'create',
                    nftContractId: nft._contractTxId,
                    nftId: 'a',
                    price: '5',
                    priceTokenId: '12',
                    expirePeriod: 3600,
                },
                { strict: true }
            ), err => {
                assert.equal(err.message, "Cannot create interaction: Offer contract is not owner of NFT: a");
                return true;
            }
            )
        });

        describe('validation', () => {
            let contract;

            before(async () => {
                ({ contract } = await deployContract())
            })

            it('should fail on wrong txId', async () => {
                await assert.rejects(contract.writeInteraction(
                    {
                        function: 'create',
                        nftContractId: '1',
                        nftId: '2',
                        price: '5',
                        priceTokenId: '12',
                        expirePeriod: 3600,
                    }
                    , { strict: true }
                ), err => {
                    assert.equal(err.message, 'Cannot create interaction: Invalid nft contractId: 1')
                    return true;
                })
            });

            it('should fail on wrong price', async () => {
                await assert.rejects(contract.writeInteraction(
                    {
                        function: 'create',
                        nftContractId: '1'.repeat(43),
                        nftId: '2',
                        price: '5.2',
                        priceTokenId: '12',
                        expirePeriod: 3600,
                    }
                    , { strict: true }
                ), err => {
                    assert.equal(err.message, 'Cannot create interaction: 5.2 price is not positive integer')
                    return true;
                })
            });

            it('should fail on wrong time', async () => {
                await assert.rejects(contract.writeInteraction(
                    {
                        function: 'create',
                        nftContractId: '1'.repeat(43),
                        nftId: '2',
                        price: '5',
                        priceTokenId: '12',
                        expirePeriod: 300,
                    }
                    , { strict: true }
                ), err => {
                    assert.equal(err.message, 'Cannot create interaction: Lock time has to be at least equal to 3600')
                    return true;
                })
            });
        })

    });


    describe('cancel', () => {
        it('should fail if signer !== owner', async () => {
            const { offer, signerAddress: ALICE } = await createOffer();
            const { jwk: BOB } = await warp.generateWallet();

            await assert.rejects(offer.connect(BOB).writeInteraction(
                {
                    function: 'cancel'
                },
                { strict: true }
            ), err => {
                assert.equal(err.message, `Cannot create interaction: Only contract owner ${ALICE} can cancel`)
                return true;
            });
        });

        it('should fail if signer !== owner', async () => {
            const { offer, signerAddress: ALICE } = await createOffer();
            const { jwk: BOB } = await warp.generateWallet();

            await assert.rejects(offer.connect(BOB).writeInteraction(
                {
                    function: 'cancel'
                },
                { strict: true }
            ), err => {
                assert.equal(err.message, `Cannot create interaction: Only contract owner ${ALICE} can cancel`)
                return true;
            });
        });

        it('should cancel if stage = PENDING', async () => {
            const { offer, signerAddress: ALICE, nft } = await createOffer();

            await offer.writeInteraction(
                {
                    function: 'cancel'
                },
                { strict: true }
            );

            // const { result } = await nft.viewState({ function: 'ownerOf', tokenId: 'a' })
            // assert.equal(result, ALICE);
        });



    });






});