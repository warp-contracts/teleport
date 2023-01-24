import { ethers, Signer } from "ethers";
import { CustomSignature, Warp } from "warp-contracts";
import { TRUSTED_OFFER_SRC_TX_ID } from "./Constants";
import ERC20 from "./ERC20";
import TeleportEscrow from "./TeleportEscrow";

const INIT_STATE = JSON.stringify({});

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

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

        if (stage !== 0) {
            throw Error(`Wrong stage of escrow: ${stage}`)
        }

        // TODO: I think we can't verify bytecode
        // if (byteCode !== TeleportEscrow.deployedBytecode) {
        //     throw Error(`Untrusted byte code`);
        // }

        const escrowOfferIdHash = await escrow.offerIdHash();
        if (escrowOfferIdHash !== solidityKeccak(offerId)) {
            throw Error("Escrow was not created for this offer")
        }

        const offer = this.warp.contract(offerId).connect(this.signer).setEvaluationOptions({ internalWrites: true });

        const { cachedValue: { state } } = await offer.readState();

        const { priceTokenId: tokenId, price, owner } = (state as any);

        const receiver = await escrow.receiver();
        if (receiver !== owner) {
            throw Error(`You are not receiver of escrow`);
        }

        const erc20 = new ethers.Contract(tokenId, ERC20.abi, this.evm);

        const lockedFunds = await erc20.balanceOf(escrowId);

        if (lockedFunds.toNumber() < Number.parseInt(price)) {
            throw Error(`Escrow is not funded`);
        }

        await offer.writeInteraction(
            {
                function: 'acceptSeller',
            },
        );
    }

    async finalize(escrowId: string, password: string) {
        // TODO: password should fetched from events
        const escrow = new ethers.Contract(escrowId, TeleportEscrow.abi, this.evm);

        await escrow.connect(this.evmSigner).finalize(password);
    }


} 
