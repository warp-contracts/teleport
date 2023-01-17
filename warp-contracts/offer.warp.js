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
                    action.caller
                ))
            })
        case 'cancel':
            const offer = deserializeOffer(state);
            return (
                {
                    state: serializeOffer(await offer.cancel(action.caller))
                }
            );

        default:
            revert(`function ${input.function} unknown`)
    }
}

// BIG ISSUE: https://github.com/warp-contracts/warp/issues/323
class Offer {
    stage = OFFER_STAGE.PENDING;
    nftContractId;
    nftId;
    price;
    priceTokenId;
    owner;
    expirePeriod;

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
            this.stage === OFFER_STAGE.CANCELED;
            await SmartWeave.contracts.write(this.nftContractId,
                { function: 'transfer', tokenId: this.nftId, to: this.owner }
            );
        } else if (this.stage === OFFER_STAGE.ACCEPTED_BY_BUYER || this.stage === OFFER_STAGE.ACCEPTED_BY_SELLER) {
            if (SmartWeave.transaction.timestamp < this.expirePeriod) {
                revert(`Offer has to expire to be canceled`);
            }
            this.stage === OFFER_STAGE.CANCELED;
            await SmartWeave.contracts.write(this.nftContractId,
                { function: 'transfer', tokenId: this.nftId, to: this.owner }
            );
        }
        else if (this.stage === OFFER_STAGE.CANCELED || this.stage === OFFER_STAGE.FINALIZED) {
            revert(`Can't cancel offer in stage ${this.stage}`)
        }

        revert(`Unknown OfferStage: ${this.stage}`);
    }


    _assertNotExpired() {
        if (SmartWeave.transaction.timestamp < this.expirePeriod) {
            revert(`Offer has expired, now it can be only canceled`);
        }
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
    'buyer',
    'hashedPassword'
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






