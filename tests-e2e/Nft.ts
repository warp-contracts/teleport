import { readFileSync, } from 'fs';
import { CustomSignature, LoggerFactory, Warp, WarpFactory } from 'warp-contracts';
import { join } from 'path';

const CONTRACT_PATH = join(process.cwd(), "warp-contracts", "nft.warp.js");
const CONTRACT_CODE = readFileSync(CONTRACT_PATH).toString();
LoggerFactory.INST.logLevel('none');

export const deployNft = async (warp: Warp, signer: CustomSignature) => {

    const { contractTxId } = await warp.deploy({
        wallet: signer,
        initState: JSON.stringify({
            idCounter: 0
        }),
        src: CONTRACT_CODE,
    });

    const contract = warp.contract(contractTxId)
        .setEvaluationOptions({ internalWrites: true })
        .connect(signer);

    await contract.writeInteraction(
        { function: 'mint', content: 'a' },
        { strict: true }
    );

    const { cachedValue: { state } } = await contract.readState();

    return { nftContract: contract, contractTxId, nftId: (state as any).idCounter };
};