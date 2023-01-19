import { ethers } from "ethers";
import { Contract, CustomSignature, Warp, WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import TeleportEscrow from "./TeleportEscrow";

const INIT_STATE = JSON.stringify({});
export const TRUSTED_OFFER_SRC_TX_ID = "8bcPZxQBIFBeGyJGNGilmKlix6fzsCzH6SxqnoSo1WI";

const ESCROW_ABI = TeleportEscrow.abi;

export class Seller {

    constructor(
        private readonly signer: CustomSignature,
        private readonly warp: Warp,
        private readonly evm: ethers.providers.JsonRpcProvider
    ) {
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

    async acceptEscrow(escrowId: string) {

        const escrow = new ethers.Contract(escrowId, TeleportEscrow.abi, this.evm);

        const stage = await escrow.stage();
        if (stage !== 1) {
            throw
        }
        // check if escrow is in good state
        // 




    }

} 
