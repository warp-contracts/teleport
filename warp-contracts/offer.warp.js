const MINIMAL_LOCK_TIME = 3600;

const OFFER_STAGE = {
    PENDING: 'PENDING',
    CANCELED: 'CANCELED',
    ACCEPTED_BY_BUYER: 'ACCEPTED_BY_BUYER',
    ACCEPTED_BY_SELLER: 'ACCEPTED_BY_SELLER',
    FINALIZED: 'FINALIZED'
}

export async function handle(state, action) {
    const { input, caller } = action;

    switch (input.function) {
        case 'create':
            if (Object.keys(state).length !== 0) {
                revert(`Can't create offer if InitialState !== {}`)
            }
            return ({
                state: serializeOffer(await Offer.create(
                    input.nftContractId,
                    input.nftId,
                    input.price,
                    input.priceTokenId,
                    input.expirePeriod,
                    input.receiver ?? action.caller
                ))
            })
        case 'cancel': {
            const offer = await deserializeOffer(state).cancel(action.caller);
            return (
                {
                    state: serializeOffer(offer)
                }
            );
        }
        case 'acceptBuyer': {
            const offer = await deserializeOffer(state).acceptBuyer(action.caller, input.hashedPassword);
            return (
                {
                    state: serializeOffer(offer)
                }
            )
        }
        case 'acceptSeller': {
            const offer = await deserializeOffer(state).acceptSeller(action.caller);
            return (
                {
                    state: serializeOffer(offer)
                }
            )
        }
        case 'finalize': {
            const offer = await deserializeOffer(state).finalize(action.caller, input.password);
            return (
                { state: serializeOffer(offer) }
            )
        }
        default:
            revert(`function ${input.function} unknown`)
    }
}

class Offer {
    stage = OFFER_STAGE.PENDING;
    nftContractId;
    nftId;
    price;
    priceTokenId;
    owner;
    expirePeriod;
    expireAt;

    buyer;
    hashedPassword;

    static async create(
        nftContractId,
        nftId,
        price,
        priceTokenId,
        expirePeriod,
        signer
    ) {
        const offer = new Offer();
        check(
            isNotEmptyString,
            nftContractId, nftId, price, priceTokenId, signer,
        )
        verifyExpireTime(expirePeriod);
        isTxIdValid(nftContractId);
        isPositiveInteger(price);

        offer.nftContractId = nftContractId;
        offer.nftId = nftId;
        offer.price = price;
        offer.priceTokenId = priceTokenId;
        offer.owner = signer;
        offer.expirePeriod = expirePeriod;

        await offer._isOfferOwnerOfNFT(signer);

        return offer;
    }

    async cancel(signer) {
        if (signer !== this.owner) {
            revert(`Only contract owner ${this.owner} can cancel`)
        }

        if (this.stage === OFFER_STAGE.PENDING) {
            this.stage = OFFER_STAGE.CANCELED;
            await SmartWeave.contracts.write(this.nftContractId,
                { function: 'transfer', tokenId: this.nftId, to: this.owner }
            );
        } else if (this.stage === OFFER_STAGE.ACCEPTED_BY_BUYER || this.stage === OFFER_STAGE.ACCEPTED_BY_SELLER) {
            if (SmartWeave.block.timestamp < this.expireAt) {
                revert(`Offer has to expire to be canceled`);
            }
            this.stage = OFFER_STAGE.CANCELED;
            await SmartWeave.contracts.write(this.nftContractId,
                { function: 'transfer', tokenId: this.nftId, to: this.owner }
            );

        }
        else if (this.stage === OFFER_STAGE.CANCELED || this.stage === OFFER_STAGE.FINALIZED) {
            revert(`Can't cancel offer in stage ${this.stage}`)
        } else {
            revert(`Unknown OfferStage: ${this.stage}`);
        }

        return this;
    }

    async acceptBuyer(signer, hashedPassword) {
        isNotEmptyString(hashedPassword);

        if (this.stage !== OFFER_STAGE.PENDING) {
            revert(`Offer to be accepted by buyer has to be in stage PENDING`)
        }

        this.expireAt = SmartWeave.block.timestamp + this.expirePeriod;
        this.hashedPassword = hashedPassword;
        this.buyer = signer;
        this.stage = OFFER_STAGE.ACCEPTED_BY_BUYER;

        return this;
    }

    async acceptSeller(signer) {
        if (signer !== this.owner) {
            revert(`Owner required`)
        }

        if (this.stage !== OFFER_STAGE.ACCEPTED_BY_BUYER) {
            revert(`Offer to be accepted by seller has to be in stage ACCEPTED_BY_BUYER`)
        }

        this.stage = OFFER_STAGE.ACCEPTED_BY_SELLER;

        return this;
    }

    async finalize(_signer, password) {
        if (this.stage !== OFFER_STAGE.ACCEPTED_BY_SELLER) {
            revert(`To finalize offer it has to be in ACCEPTED_BY_SELLER stage`)
        }

        const encoded = SmartWeave.extensions.ethers.utils.defaultAbiCoder.encode(["string"], [password]);
        const hash = SmartWeave.extensions.ethers.utils.keccak256(encoded);

        if (this.hashedPassword !== hash) {
            revert(`Password doesn't match`)
        }

        await SmartWeave.contracts.write(this.nftContractId,
            { function: 'transfer', tokenId: this.nftId, to: this.buyer }
        )

        this.stage = OFFER_STAGE.FINALIZED;
        this.password = password;

        return this;
    }

    async _isOfferOwnerOfNFT() {
        const response = await SmartWeave.contracts.viewContractState(this.nftContractId,
            { function: 'ownerOf', tokenId: this.nftId }
        );

        if (response?.type === 'error') {
            revert(`Failed to read contract state ${this.nftContractId}::ownerOf(${this.nftId}): ${response.errorMessage}`);
        } else if (response?.type === 'ok') {
            if (response.result !== SmartWeave.contract.id) {
                revert(`Offer contract is not owner of NFT: ${this.nftId}`)
            }
        } else {
            revert(`Failed to read contract state ${this.nftContractId}::ownerOf(${this.nftId}): unknown error`);
        }
    }

}
const OFFER_KEYS = [
    'stage',
    'nftContractId',
    'nftId',
    'price',
    'priceTokenId',
    'owner',
    'expireAt',
    'expirePeriod',
    'buyer',
    'hashedPassword',
    'password'
];

function serializeOffer(offer) {
    const serialized = {};
    for (const key of OFFER_KEYS) {
        serialized[key] = offer[key];
    }
    return serialized;
}

function deserializeOffer(obj) {
    const offer = new Offer();
    for (const key of OFFER_KEYS) {
        offer[key] = obj[key];
    }
    return offer;
}

function isNotEmptyString(value) {
    if (typeof value === 'string' && value !== '') {
        return;
    }
    revert(`${value} should be not empty string`);
}

function verifyExpireTime(period) {
    if (period < MINIMAL_LOCK_TIME) {
        revert(`Lock time has to be at least equal to ${MINIMAL_LOCK_TIME}`)
    }
}

function isPositiveInteger(str) {
    if (typeof str !== 'string') {
        revert(`${str} price is not positive integer`)
    }

    const num = Number(str);

    if (Number.isInteger(num) && num > 0) {
        return num;
    }

    revert(`${str} price is not positive integer`)
}

function isTxIdValid(txId) {
    const validTxIdRegex = /[a-z0-9_-]{43}/i;
    const isValid = validTxIdRegex.test(txId);
    if (!isValid) {
        revert(`Invalid nft contractId: ${txId}`)
    }
}


function check(fn, ...values) {
    values.map(fn);
}


function revert(message) {
    throw new ContractError(message);
}
