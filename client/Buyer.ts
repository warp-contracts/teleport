import { CustomSignature, Warp } from "warp-contracts";
import { ethers, Signer } from 'ethers';
import EscrowEvm from './TeleportEscrow';
import EscrowFactoryEvm from './TeleportEscrowFactory';
import ERC20 from "./ERC20";
import { SafeContract } from "./SafeContract";

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

export class Buyer {

    constructor(
        private readonly warpSigner: CustomSignature,
        private readonly warp: Warp,
        private readonly evm: ethers.providers.JsonRpcProvider,
        private readonly evmSigner: Signer,
        private readonly offerSrcTxId: string,
        private readonly escrowFactoryAddress: string
    ) {
    }

    async acceptOffer(offerId: string, password: string, matcher?: { url: string, }) {
        const offerContract = new SafeContract(this.warp, this.warpSigner, offerId);

        const offerState = await offerContract.read();
        await this.verifyOffer(offerState, offerId);

        const { erc20, escrow } = await this.deployEscrow({ ...offerState, offerId }, password);

        await this.fundEscrow(erc20, escrow, offerState.price);

        if (matcher) {
            const { status } = await fetch(matcher.url, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password, offerId, from: await this.evmSigner.getAddress(), op: "trackBuyer" })
            });
            if (status != 200) {
                throw Error("Failed to trigger matcher");
            }
        }

        return { escrowId: escrow.address }
    }

    async finalize(offerId: string, password: string, receiver?: string) {
        const offerContract = new SafeContract(this.warp, this.warpSigner, offerId);

        const offerState = await offerContract.read();

        const effectiveReceiver = receiver ? receiver : await this.evmSigner.getAddress();

        if (offerState.stage !== 'ACCEPTED_BY_SELLER') {
            throw Error(`Wrong offer stage: ${offerState.stage}`)
        }

        if (offerState.buyer !== effectiveReceiver) {
            throw Error(`You are not pointed as receiver of offer`)
        }

        if (offerState.hashedPassword !== solidityKeccak(password)) {
            throw Error(`Hash of password from offer doesn't match with password from escrow`);
        }

        await offerContract.call(
            { function: 'finalize', password }
        )
    }

    private async verifyOffer(offerState: any, offerId: string) {
        if (offerState.stage !== 'PENDING') {
            throw Error(`Wrong offer stage: ${offerState.stage}`);
        }

        const rawContract = await fetch(`https://gateway.redstone.finance/gateway/contract?txId=${offerId}`).then(res => res.json()).catch(err => { throw Error('Gateway error'); });

        if (rawContract.srcTxId !== this.offerSrcTxId) {
            throw Error(`Src Tx Id is not trusted: ${rawContract.srcTxId}`);
        }

        if (JSON.stringify(rawContract.initState) !== '{}') {
            throw Error(`Contract was initialized with init state: ${rawContract.initState}`);
        }
        return offerState;
    }

    private async fundEscrow(erc20: ethers.Contract, escrow: ethers.Contract, price: string) {
        await erc20.connect(this.evmSigner).transfer(escrow.address, price).then((tx: any) => tx.wait());
    }

    async deployEscrow({ owner, price, priceTokenId, offerId }: any, password: string) {
        const offerIdHash = solidityKeccak(offerId);
        const erc20 = new ethers.Contract(priceTokenId, ERC20.abi, this.evm).connect(this.evmSigner);
        const escrowFactory = new ethers.Contract(this.escrowFactoryAddress, EscrowFactoryEvm.abi, this.evm).connect(this.evmSigner);

        const deployTx = await escrowFactory.createNewEscrow(
            3600,
            owner,
            solidityKeccak(password),
            price,
            priceTokenId,
            offerIdHash
        ).then((tx: any) => tx.wait());

        if (
            deployTx.events
            &&
            deployTx.events.length >= 1
            &&
            deployTx.events[0].args
            &&
            deployTx.events[0].args.length >= 1
        ) {
            const escrowAddress = deployTx.events[0].args[0];
            const escrow = new ethers.Contract(escrowAddress, EscrowEvm.abi, this.evm).connect(this.evmSigner);
            return { erc20, escrow }
        } else {
            throw Error("Failed to get deployed escrow address");
        }
    }
}