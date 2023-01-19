import { ethers, Signer } from "ethers";
import { CustomSignature, Warp } from "warp-contracts";
import TeleportEscrow from "./TeleportEscrow";

const INIT_STATE = JSON.stringify({});
export const TRUSTED_OFFER_SRC_TX_ID = "8bcPZxQBIFBeGyJGNGilmKlix6fzsCzH6SxqnoSo1WI";

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

        const offer = this.warp.contract(deployment.contractTxId).connect(this.signer);

        const nft = this.warp.contract(nftContractId).connect(this.signer);

        await nft.writeInteraction(
            { function: 'transfer', tokenId: nftId, to: deployment.contractTxId },
            { strict: true }
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

        const offer = this.warp.contract(offerId).connect(this.signer);

        await offer.writeInteraction(
            {
                function: 'acceptSeller',
            },
            { strict: true }
        );
    }

    async finalize(escrowId: string, password: string) {
        const escrow = new ethers.Contract(escrowId, TeleportEscrow.abi, this.evm);

        await escrow.connect(this.evmSigner).finalize(password);
    }


} 
