import assert from 'assert';
import { readFileSync, } from 'fs';
import { LoggerFactory, WarpFactory } from 'warp-contracts';
import { join } from 'path';
import { describe, it, before, after } from 'node:test';
import Arl from 'arlocal';
import { EthersExtension } from 'warp-contracts-plugin-ethers';
import { ethers } from 'ethers';

const CONTRACT_PATH_OFFER = join("warp-contracts", "offer.warp.js");
const warp = WarpFactory.forLocal(1411).use(new EthersExtension());
const CONTRACT_CODE_OFFER = readFileSync(CONTRACT_PATH_OFFER).toString();
LoggerFactory.INST.logLevel('none');

async function deployContract(initState) {
    const { jwk: signer, address: signerAddress } = await warp.generateWallet();

    const { contractTxId } = await warp.deploy({
        wallet: signer,
        initState: initState ?? JSON.stringify({}),
        src: CONTRACT_CODE_OFFER,
        evaluationManifest: {
            internalWrites: true
        }
    });

    const contract = warp.contract(contractTxId)
        .setEvaluationOptions({
            internalWrites: true,
        })
        .connect(signer);

    return { contract, signer, signerAddress, warp };
}

async function deployNft({ owner, content }, signer) {
    const symbol = "mike__" + Math.ceil(Math.random() * 1000);
    const result = await warp.deploy({
        src: readFileSync(join("warp-contracts", "nft.warp.js")).toString(),
        initState: JSON.stringify({
            name: "mike-test-nft",
            owner: owner,
            description: content,
            symbol,
            decimals: 0,
            totalSupply: 1,
            balances: { [owner]: 1 },
            allowances: {},
        }),
        wallet: signer,
        tags: [{ name: "Indexed-By", value: "atomic-asset" }]
    })

    const contract = warp.contract(result.contractTxId)
        .setEvaluationOptions({ internalWrites: true })
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

    const createOffer = async (expirePeriod, delegate) => {
        const { contract, signer, signerAddress } = await deployContract();
        const { contract: nft } = await deployNft({ content: 'a', owner: signerAddress }, signer);

        await nft.writeInteraction({
            function: 'transfer', amount: 1, to: contract._contractTxId,
        });

        await contract.writeInteraction(
            {
                function: 'create',
                nftContractId: nft._contractTxId,
                price: '5',
                priceTokenId: '12',
                expirePeriod: expirePeriod ?? 3600,
                delegate
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
            const { contract: nft } = await deployNft({ content: 'a', owner: signerAddress }, signer);

            await nft.writeInteraction({
                function: 'transfer', amount: 1, to: contract._contractTxId
            });

            await contract.writeInteraction(
                {
                    function: 'create',
                    nftContractId: nft._contractTxId,
                    price: '5',
                    priceTokenId: '12',
                    expirePeriod: 3600,
                },
                { strict: true }
            );
        });

        it(`should fail to create offer, if contract is not owner`, async () => {
            const { contract, signer, signerAddress } = await deployContract();
            const { contract: nft } = await deployNft({ content: 'a', owner: signerAddress }, signer);

            await assert.rejects(contract.writeInteraction(
                {
                    function: 'create',
                    nftContractId: nft._contractTxId,
                    price: '5',
                    priceTokenId: '12',
                    expirePeriod: 3600,
                },
                { strict: true }
            ))
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


        it('should cancel if stage = PENDING', async () => {
            const { offer, signerAddress: ALICE, nft } = await createOffer();

            await offer.writeInteraction(
                {
                    function: 'cancel'
                },
                { strict: true }
            );

            const { cachedValue: { state: { owner } } } = await nft.readState();
            assert.equal(owner, ALICE);
        });

        it.todo('should cancel when stage == ACCEPTED_BY_BUYER')
        it.todo('should cancel when stage == ACCEPTED_BY_SELLER')
        it.todo('should  fail to cancel when stage == FINALIZED')
        it.todo('should  fail to cancel when stage == CANCELED')
        it.todo('should  fail to cancel when before expireAt')
    });

    describe('acceptSeller', () => {
        it('should  accept by seller', async () => {
            const { offer } = await createOffer();

            await offer.writeInteraction(
                {
                    function: 'acceptSeller',
                    hashedPassword: "123",
                    buyerAddress: '521'
                },
                { strict: true }
            );

            const { cachedValue } = await offer.readState();
            assert.equal(
                cachedValue.state.stage,
                "ACCEPTED_BY_SELLER"
            );
            assert.ok(
                cachedValue.state.expireAt
            );
        });

        it('should  accept by delegate if set', async () => {
            const { jwk: BOT, address: BOT_ADDRESS } = await warp.generateWallet();
            const { offer } = await createOffer(3600, BOT_ADDRESS);

            await offer.connect(BOT).writeInteraction(
                {
                    function: 'acceptSeller',
                    hashedPassword: "123",
                    buyerAddress: '521'
                },
                { strict: true }
            );

            const { cachedValue } = await offer.readState();
            assert.equal(
                cachedValue.state.stage,
                "ACCEPTED_BY_SELLER"
            );
            assert.ok(
                cachedValue.state.expireAt
            );
        });
    });


    describe('finalize', () => {
        it('should finalize', async () => {
            const { offer, nft, signer: ALICE } = await createOffer();
            const { jwk: BOB, address: BOB_ADDRESS } = await warp.generateWallet();

            const password = "312"
            const hashedPassword = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [password]));


            await offer.connect(ALICE).writeInteraction(
                {
                    function: 'acceptSeller',
                    hashedPassword,
                    buyerAddress: BOB_ADDRESS
                },
                { strict: true }
            );

            await offer.writeInteraction(
                {
                    function: 'finalize',
                    password
                },
                { strict: true }
            );


            const { cachedValue: { state: { owner } } } = await nft.readState()
            assert.equal(owner, BOB_ADDRESS);
        });

        it('should fail to finalize, if wrong password provided', async () => {
            const { offer, nft, signer: ALICE } = await createOffer();
            const { jwk: BOB, address: BOB_ADDRESS } = await warp.generateWallet();

            const password = "312"
            const hashedPassword = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [password]));

            await offer.connect(ALICE).writeInteraction(
                {
                    function: 'acceptSeller',
                    hashedPassword,
                    buyerAddress: BOB_ADDRESS
                },
                { strict: true }
            );

            await assert.rejects(offer.writeInteraction(
                {
                    function: 'finalize',
                    password: password + "1"
                },
                { strict: true }
            ), err => {
                assert.equal(err.message, "Cannot create interaction: Password doesn't match")
                return true;
            })
        });
    });
});