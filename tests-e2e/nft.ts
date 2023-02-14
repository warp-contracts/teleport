//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { Signer, Wallet } from "ethers";
import { Warp } from "warp-contracts";

const NFT_SRC_TX_ID = "ZXKdoE-WnH7NQATZKfER0rrrCNwOGfdSD42lWzHJ03g";

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })

export async function deployNft(warp: Warp, wallet: Wallet, initState = {}) {
    const symbol = "mike__" + Math.ceil(Math.random() * 1000);
    const signer = makeWarpEvmSigner(wallet);
    const result = await warp.deployFromSourceTx({
        initState: JSON.stringify({
            name: "mike-test-nft",
            owner: wallet.address,
            symbol,
            decimals: 0,
            totalSupply: 1,
            balances: { [wallet.address]: 1 },
            allowances: {},
            ...initState
        }),
        srcTxId: NFT_SRC_TX_ID,
        wallet: signer,
        tags: [{ name: "Indexed-By", value: "atomic-asset" }],
        evaluationManifest: {
            evaluationOptions: {
                internalWrites: true
            }
        }
    })

    const nftContract = warp.contract<any>(result.contractTxId).setEvaluationOptions({ internalWrites: true }).connect(signer);

    return { nftContract, contractTxId: result.contractTxId };
}