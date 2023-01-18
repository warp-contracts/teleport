export class Clock {
    static s = 1;
}

class Contract {
    contractId = Math.ceil(Math.random() * 1000).toString();
}

export const hash = (password: string) => 'hashed_' + password;

/**
 * NFT on arweave
 */
export class NFT extends Contract {

    constructor(
        public id: string,
        public owner: string
    ) {
        super();
    }

    transfer(signer: string, to: string) {
        if (signer !== this.owner) {
            throw Error('NFT: Wrong signer')
        }
        this.owner = to;
    }

    ownerOf() {
        return this.owner;
    }
}

/**
 * ERC20 token on polygon
 */
export class Token extends Contract {
    public qty = 0;
    public name: string;
    public balances: Record<string, number>;

    constructor(name: string, balances = {}) {
        super();
        this.name = name;
        this.balances = balances
    }

    transfer(signer: string, to: string, amount: number) {
        this.balances[to] = this.balances[to] || 0;
        this.balances[signer] -= amount;
        this.balances[to] += amount;
    }
}

export enum OfferState {
    PENDING = 'PENDING',
    CANCELED = 'CANCELED',
    ACCEPTED_BY_BUYER = 'ACCEPTED_BY_BUYER',
    ACCEPTED_BY_SELLER = 'ACCEPTED_BY_SELLER',
    FINALIZED = 'FINALIZED'
};

const revert = (message: string) => { throw Error(message) }

/**
 * Offer on warp
 */
export class Offer extends Contract {
    public state: OfferState;
    public buyer: string;
    public hashedPassword: string;

    constructor(
        public readonly value: number,
        public readonly token: string,
        public readonly nft: NFT,
        public readonly expireAt: number,
        public readonly owner: string
    ) {
        super();
        this.state = OfferState.PENDING;

        if (owner !== nft.owner) {
            revert("Only owner of nft can create offer on it")
        }

    }

    static async create(value: number, token: string, nft: NFT, owner: string) {
        // https://github.com/warp-contracts/warp#deployfromsourcetx
        return new Offer(
            value,
            token,
            nft,
            Clock.s + 3600,
            owner
        )
    }

    async acceptBuyer(signer: string, hashedPassword: string) {
        if (this.state !== OfferState.PENDING) {
            throw Error(`Offer: PENDING state required`);
        }
        this.buyer = signer;
        this.hashedPassword = hashedPassword;
        this.state = OfferState.ACCEPTED_BY_BUYER;
    }

    async acceptSeller(signer: string) {
        if (this.state !== OfferState.ACCEPTED_BY_BUYER) {
            throw Error(`Offer: ACCEPTED_BY_BUYER state required`);
        }

        if (signer !== this.owner) {
            throw Error(`Wrong signer`)
        }

        this.state = OfferState.ACCEPTED_BY_SELLER;
    }

    async finalize(password: string) {
        if (this.state !== OfferState.ACCEPTED_BY_SELLER) {
            throw Error(`Offer: ACCEPTED_BY_SELLER state required`);
        }

        if (this.hashedPassword !== hash(password)) {
            throw Error(`Wrong password`);
        }

        await this.nft.transfer(this.contractId, this.buyer);
        this.state = OfferState.FINALIZED;
    }

    async cancel(signer: string) {
        if (this.owner !== signer) {
            throw Error("Not authorized");
        }
        if (!(this.expireAt > Clock.s)) {
            throw Error("Can't cancel active offer");
        }

        await this.nft.transfer(this.contractId, this.owner);
        this.state = OfferState.CANCELED;
    }
}

/**
 * Escrow on polygon
 */
export class Escrow extends Contract {

    constructor(
        public readonly expireAt: number,
        public readonly receiver: string,
        public readonly hashedPassword: string,
        public readonly amount: number,
        public readonly token: Token,
        public readonly owner: string
    ) {
        super();
    }

    async withdrawToReceiver(password: string) {
        if (this.hashedPassword !== hash(password)) {
            throw Error('Wrong password')
        }

        await this.token.transfer(this.contractId, this.receiver, this.amount);
    }

    async withdrawToOwner() {
        if (Clock.s <= this.expireAt) {
            throw Error('Lock is still active')
        }
        await this.token.transfer(this.contractId, this.owner, this.amount);
    }

}

export interface Price {
    value: number,
    token: string
}

/**
 * Owner of NFT
 */
export class NFTSeller {

    constructor(
        public readonly signer: string,
    ) {
    }

    async postOffer({ value, token }: Price, nft: NFT) {
        const offer = await Offer.create(value, token, nft, this.signer);
        await nft.transfer(this.signer, offer.contractId);

        return offer;
    }

    async acceptOffer(offer: Offer) {
        await offer.acceptSeller(this.signer);
    }

    async consumeEscrow(escrow: Escrow, password: string) {
        await escrow.withdrawToReceiver(password);
    }
}

/**
 * Owner of Token which want to buy NFT for it
 */
export class NFTBuyer {
    constructor(
        public readonly signer: string,
        public readonly token: Token,
    ) {
    }

    async acceptOffer(offer: Offer, password: string) {
        const hashedPassword = hash(password);
        const escrow = new Escrow(Clock.s + 3600, offer.owner, hashedPassword, Number(offer.value), this.token, this.signer);
        await this.token.transfer(this.signer, escrow.contractId, offer.value);

        await offer.acceptBuyer(this.signer, hashedPassword);

        return escrow;
    }

    async consumeOffer(offer: Offer, password: string) {
        await offer.finalize(password);
    }
}