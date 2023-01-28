import { ethers, Signer } from "ethers";
import { CustomSignature, Warp } from "warp-contracts";
import ERC20 from "./ERC20";
import { SafeContract } from "./SafeContract";
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
        private readonly evmSigner: Signer,
        private readonly offerSrcTxId: string,
    ) {
    }

    async createOffer(nftContractId: string, nftId: string, price: string, priceTokenId: string, receiver?: string) {
        const deployment =
            await this.warp.deployFromSourceTx({
                srcTxId: this.offerSrcTxId,
                wallet: this.signer,
                initState: INIT_STATE,
                evaluationManifest: {
                    evaluationOptions: { internalWrites: true },
                    plugins: ['evm-signature-verification', 'smartweave-extension-ethers'],
                }
            });

        const offer = this.getWarpContract(deployment.contractTxId);
        const nft = this.getWarpContract(nftContractId);

        await nft.call(
            { function: 'transfer', tokenId: nftId, to: deployment.contractTxId },
        );

        await offer.call(
            {
                function: 'create',
                nftContractId,
                nftId,
                price,
                priceTokenId,
                expirePeriod: 3600,
                receiver
            },
        );

        return { offerId: deployment.contractTxId }
    }

    private getWarpContract(id: string) {
        return new SafeContract(this.warp, this.signer, id);
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

        const offer = this.getWarpContract(offerId);
        const state = await offer.read();

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

        await offer.call(
            {
                function: 'acceptSeller',
            },
        );
    }

    async finalize(escrowId: string, offerId: string) {
        const escrow = new ethers.Contract(escrowId, TeleportEscrow.abi, this.evm);
        const offer = this.getWarpContract(offerId);

        const state = await offer.read();

        if (!state.password) {
            throw Error(`Password not relieved`)
        }

        await escrow.connect(this.evmSigner).finalize(state.password).then((tx: any) => tx.wait());
    }


} 
