import { ethers, Signer } from "ethers";
import { CustomSignature, Warp } from "warp-contracts";
import TeleportEscrow from "./TeleportEscrow";

const INIT_STATE = JSON.stringify({});
export const TRUSTED_OFFER_SRC_TX_ID = "BqQywTrXd-v1hmqsxroUoyugwvz8gy-pkKdUBSd-rPA";

export class Seller {

    constructor(
        private readonly signer: CustomSignature,
        private readonly warp: Warp,
        private readonly evm: ethers.providers.JsonRpcProvider,
        private readonly evmSigner: Signer
    ) {
        this.evmSigner = this.evmSigner.connect(this.evm)
    }

    async createOffer(nftContractId: string, nftId: string, price: string, priceTokenId: string) {
        const deployment =
            await this.warp.deployFromSourceTx({
                srcTxId: TRUSTED_OFFER_SRC_TX_ID,
                wallet: this.signer,
                initState: INIT_STATE,
                evaluationManifest: {
                    evaluationOptions: { internalWrites: true },
                    plugins: ['evm-signature-verification', 'smartweave-extension-ethers'],
                }
            });

        const offer = this.getWarpContract(deployment.contractTxId);
        const nft = this.getWarpContract(nftContractId);

        await nft.writeInteraction(
            { function: 'transfer', tokenId: nftId, to: deployment.contractTxId },
        );

        await offer.writeInteraction(
            {
                function: 'create',
                nftContractId,
                nftId,
                price,
                priceTokenId,
                expirePeriod: 3600,
            },
            { strict: true }
        );

        return { offerId: deployment.contractTxId }
    }

    private getWarpContract(id: string) {
        return this.warp.contract(id).connect(this.signer).setEvaluationOptions({ internalWrites: true });
    }

    async acceptEscrow(escrowId: string, offerId: string) {
        const escrow = new ethers.Contract(escrowId, TeleportEscrow.abi, this.evm);

        const stage = await escrow.stage();

        if (stage !== 1) {
            throw Error(`Wrong stage of escrow: ${stage}`)
        }

        const byteCode = await this.evm.getCode(escrowId);

        if (byteCode !== TeleportEscrow.deployedBytecode) {
            throw Error(`Unknown byte code`);
        }

        const offer = this.warp.contract(offerId).connect(this.signer).setEvaluationOptions({ internalWrites: true });

        await offer.writeInteraction(
            {
                function: 'acceptSeller',
            },
        );
    }

    async finalize(escrowId: string, password: string) {
        const escrow = new ethers.Contract(escrowId, TeleportEscrow.abi, this.evm);

        await escrow.connect(this.evmSigner).finalize(password);
    }


} 
