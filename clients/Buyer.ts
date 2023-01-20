import { Contract, CustomSignature, Warp } from "warp-contracts";
import { TRUSTED_OFFER_SRC_TX_ID } from "./Seller";
import { ContractFactory, ethers, Signer } from 'ethers';
import EscrowEvm from './TeleportEscrow';

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

export class Buyer {

    constructor(
        private readonly warpSigner: CustomSignature,
        private readonly warp: Warp,
        private readonly evm: ethers.providers.JsonRpcProvider,
        private readonly evmSigner: Signer
    ) {
        this.evmSigner = this.evmSigner.connect(this.evm)
    }

    async acceptOffer(offerId: string, password: string) {
        const offerContract = this.warp.contract(offerId).setEvaluationOptions(
            { internalWrites: true }
        ).connect(this.warpSigner);

        const offerState = await this.verifyOffer(offerContract, offerId);

        await offerContract.writeInteraction(
            { function: 'acceptBuyer', hashedPassword: solidityKeccak(password) },
            { strict: true }
        )

        const { erc20, escrow } = await this.deployEscrow(offerState, password); // cost?? becaon proxy

        await this.fundEscrow(erc20, escrow, offerState);

        return { escrowId: escrow.address }
    }

    async finalize(offerId: string, password: string) {
        const offerContract = this.warp.contract(offerId).setEvaluationOptions(
            { internalWrites: true }
        ).connect(this.warpSigner);

        const { cachedValue: { state } } = await offerContract.readState();

        const offerState = state as any;

        if (offerState.stage !== 'ACCEPTED_BY_SELLER') {
            throw Error(`Wrong offer stage: ${offerState.stage}`)
        }

        await offerContract.writeInteraction(
            { function: 'finalize', password },
            { strict: true }
        );
    }

    private async verifyOffer(offerContract: Contract, offerId: string) {
        const { cachedValue: { state } } = await offerContract.readState();

        const offerState = state as any;

        if (offerState.stage !== 'PENDING') {
            throw Error(`Wrong offer stage: ${offerState.stage}`);
        }

        const rawContract = await fetch(`https://gateway.redstone.finance/gateway/contract?txId=${offerId}`).then(res => res.json()).catch(err => { throw Error('Gateway error'); });

        if (rawContract.srcTxId !== TRUSTED_OFFER_SRC_TX_ID) {
            throw Error(`Src Tx Id is not trusted: ${rawContract.srcTxId}`);
        }

        if (JSON.stringify(rawContract.initState) !== '{}') {
            throw Error(`Contract was initialized with init state: ${rawContract.initState}`);
        }
        return offerState;
    }

    private async fundEscrow(erc20: ethers.Contract, escrow: ethers.Contract, offerState: any) {
        await erc20.connect(this.evmSigner).transfer(escrow.address, offerState.price, { gasLimit: 21000000 });
        await escrow.connect(this.evmSigner).markAsFunded({ gasLimit: 21000000 });
    }

    private async deployEscrow(offerState: any, password: string) {
        const erc20 = new ethers.Contract(offerState.priceTokenId, ERC20_ABI, this.evm).connect(this.evmSigner);
        const escrowFactory = new ContractFactory(EscrowEvm.abi, EscrowEvm.bytecode, this.evmSigner);
        const escrow = await escrowFactory.deploy(
            36000,
            offerState.owner,
            solidityKeccak(password),
            offerState.price,
            offerState.priceTokenId
        ); // cost?? becaon proxy
        return { erc20, escrow };
    }
}