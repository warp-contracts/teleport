import assert from 'assert';
import { readFileSync, } from 'fs';
import { LoggerFactory, WarpFactory } from 'warp-contracts';
import { join } from 'path';
import { describe, it, before, after } from 'node:test';
import Arl from 'arlocal';

const CONTRACT_PATH = join("warp-contracts", "nft.warp.js");
const warp = WarpFactory.forLocal(1220);
const CONTRACT_CODE = readFileSync(CONTRACT_PATH).toString();
LoggerFactory.INST.logLevel('none');

async function deployContract() {
    const { jwk: signer, address: signerAddress } = await warp.generateWallet();

    const { contractTxId } = await warp.deploy({
        wallet: signer,
        initState: JSON.stringify({
            idCounter: 0
        }),
        src: CONTRACT_CODE,
    });

    const contract = warp.contract(contractTxId)
        .connect(signer);


    return { contract, signer, signerAddress, warp };
}

describe('simplest NFT', () => {
    let arlocal;

    before(async () => {
        arlocal = new Arl.default(1220, false);

        await arlocal.start();
    });

    after(async () => {
        await arlocal.stop();
    });

    it('should deploy contract', async () => {
        const { contract } = await deployContract();
        assert.ok(contract);
    });


    it('should mint nft', async () => {
        const { signerAddress, contract } = await deployContract();

        await contract.writeInteraction(
            { function: 'mint', content: 'a' },
            { strict: true }
        );

        const { cachedValue: { state } } = await contract.readState();

        assert.deepStrictEqual(
            state,
            {
                '1': { owner: signerAddress, content: 'a' },
                idCounter: '1'
            },
        );
    });

    it('should transfer nft', async () => {
        const { contract } = await deployContract();

        await contract.writeInteraction(
            { function: 'mint', content: 'a' }
        );

        await contract.writeInteraction(
            { function: 'transfer', tokenId: '1', to: 'X' }
        );

        const { cachedValue: { state } } = await contract.readState();


        assert.deepStrictEqual(
            state,
            {
                '1': { owner: 'X', content: 'a' },
                idCounter: '1'
            },
        );
    });

    it('should fail to transfer nft if not owner', async () => {
        const { contract } = await deployContract();

        await contract.writeInteraction(
            { function: 'mint', content: 'a' }
        );

        const { jwk: signer } = await warp.generateWallet();
        await assert.rejects(
            contract.connect(signer).writeInteraction(
                { function: 'transfer', tokenId: '1', to: 'X' },
                { strict: true }
            ),
            err => {
                assert.equal(err.message, 'Cannot create interaction: only owner can transfer');
                return true;
            }
        )
    });

    it('owner of', async () => {
        const { contract, signerAddress } = await deployContract();

        await contract.writeInteraction(
            { function: 'mint', content: 'a' }
        );

        const { result } = await contract.viewState({
            function: 'ownerOf',
            tokenId: '1'
        })

        assert.equal(
            result,
            signerAddress
        )
    });

});