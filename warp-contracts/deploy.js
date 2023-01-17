const { readFileSync } = require('node:fs');

const CONTRACTS = [
    "lens.warp.js",
]

export async function deployContracts() {
    const warp = WarpFactory.forMainnet();
    await Promise.all(CONTRACTS.map(contract => deployContract(warp, contract)));
}

export async function deployContract(warp, contractPath) {
    const contractSrcPath = path.join(process.cwd(), 'contracts', contractPath);

    const { jwk: signer } = await warp.generateWallet();

    const { contractTxId } = await warp.createContract.deploy({
        wallet: signer,
        initState: JSON.stringify({
            "lens-profile:oracleConfiguration": {
                threshold: 1,
                trustedOracles: ["0xa4b95c9523d98c1860C715B915971F95306af5D0"]
            }
        }),
        src: bundledContractSrc.outputFiles[0].text,
        evaluationManifest: {
            evaluationOptions: {
                useKVStorage: true
            }
        }
    });

    console.log({ contractPath, contractTxId })
}


deployContracts();