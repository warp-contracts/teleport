import { WarpFactory } from 'warp-contracts';
import * as path from 'path';
import { readFileSync } from 'fs';

const CONTRACTS = [
    "offer.warp.js",
]

export async function deployContracts() {
    const warp = WarpFactory.forMainnet();

    await Promise.all(CONTRACTS.map(contract => deployContract(warp, contract)));
}

export async function deployContract(warp, contractPath) {
    const contractSrcPath = path.join(process.cwd(), `warp-contracts`, contractPath);

    const { jwk: signer } = await warp.generateWallet();

    const response = await warp.createSourceTx({
        src: readFileSync(contractSrcPath).toString(),
    }, signer)

    const srcTxId = await warp.saveSourceTx(response);

    console.log({ srcTxId })
}


deployContracts();