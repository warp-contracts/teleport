import { CustomSignature, Warp } from "warp-contracts";
import { TRUSTED_OFFER_SRC_TX_ID } from "./Seller";
import { ContractFactory, ethers, Signer } from 'ethers';
import EscrowEvm from './TeleportEscrow';

const WHITELISTED_TOKENS = [
    '0x0165878A594ca255338adfa4d48449f69242Eb8F' // deployed on local node
]

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
];



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
        );
        const { cachedValue: { state } } = await offerContract.readState();

        const offerState = state as any;

        if (offerState.stage !== 'PENDING') {
            throw Error(`Wrong offer stage: ${offerState.stage}`)
        }

        if (!WHITELISTED_TOKENS.includes(offerState.priceTokenId)) {
            throw Error(`Price token id is not whitelisted ${offerState.priceTokenId}`)
        }

        const rawContract = await fetch(`https://gateway.redstone.finance/gateway/contract?txId=${offerId}`).then(res => res.json()).catch(err => { throw Error('Gateway error') })

        if (rawContract.srcTxId !== TRUSTED_OFFER_SRC_TX_ID) {
            throw Error(`Src Tx Id is not trusted: ${rawContract.srcTxId}`)
        }

        if (JSON.stringify(rawContract.initState) !== '{}') {
            throw Error(`Contract was initialized with init state: ${rawContract.initState}`)
        }

        const erc20 = new ethers.Contract(offerState.priceTokenId, ERC20_ABI, this.evm).connect(this.evmSigner);

        const escrowFactory = new ContractFactory(EscrowEvm.abi, EscrowEvm.bytecode, this.evmSigner);
        const escrow = await escrowFactory.deploy(
            36000,
            offerState.owner,
            "0x" + '1'.repeat(64),
            offerState.price,
            offerState.priceTokenId,
        );

        await erc20.connect(this.evmSigner).transfer(escrow.address, offerState.price, { gasLimit: 21000000 });
        await escrow.connect(this.evmSigner).markAsFunded({ gasLimit: 21000000 });


        return { escrowId: escrow.address }
    }

}