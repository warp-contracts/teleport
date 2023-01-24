import toast, { Toaster } from 'react-hot-toast';
import { ethers } from 'ethers';
import warp from './warp';
import { fetchAllOffers, } from './client/Offers';
import { ESCROW_FACTORY_ADDRESS, TRUSTED_OFFER_SRC_TX_ID } from "./client/Constants";
import { Buyer } from './client/Buyer';
import { useEffect, useRef, useState } from 'react';
import { getRandomValue, encodeBytes } from './random';

export function OfferList({ connection }) {
    const [offers, setOffers] = useState([]);
    const [tab, setTab] = useState("PENDING");
    const buyer = new Buyer(
        { signer: connection.evmSignature, type: 'ethereum' },
        connection.warp,
        connection.evmProvider,
        connection.signer
    );

    const initializedOffers = offers.filter(offer => offer.stage);

    const filteredOffers = {
        "PENDING": initializedOffers.filter(offer => offer.stage === 'PENDING'),
        "ACCEPTED_BY_BUYER": initializedOffers.filter(offer => offer.stage === 'ACCEPTED_BY_BUYER' && offer.buyer, connection.address),
        "ACCEPTED_BY_SELLER": initializedOffers.filter(offer => offer.stage === 'ACCEPTED_BY_SELLER' && offer.buyer === connection.address),
        "FINALIZED": initializedOffers.filter(offer => offer.stage === 'FINALIZED' && offer.buyer === connection.address)
    }

    useEffect(() => {
        fetchAllOffers(TRUSTED_OFFER_SRC_TX_ID, warp, 20)
            .then(setOffers)
    }, [setOffers]);

    const updateOffer = async (offerId) => {
        const { cachedValue: { state } } = await connection.warp.contract(offerId).readState();
        setOffers(offers.map(o => {
            if (o.id === offerId) {
                return { ...o, ...state, isMarked: true };
            }
            return o;
        }))
    }

    return (
        <div>
            <h1 className="title has-text-centered">Offer List</h1>
            <h2 className="subtitle has-text-centered">
                Here you can buy NFTs from arweave, and pay for them using ERC20 tokens on Polygon.
            </h2>
            <div className="box">
                <div className="tabs">
                    <ul>
                        <li className={tab === "PENDING" ? "is-active" : ""}><a onClick={() => setTab("PENDING")}>Pending</a></li>
                        <li className={tab === "ACCEPTED_BY_BUYER" ? "is-active" : ""}><a onClick={() => setTab("ACCEPTED_BY_BUYER")}>Accepted by you</a></li>
                        <li className={tab === "ACCEPTED_BY_SELLER" ? "is-active" : ""}><a onClick={() => setTab("ACCEPTED_BY_SELLER")}>Accepted by seller</a></li>
                        <li className={tab === "FINALIZED" ? "is-active" : ""}><a onClick={() => setTab("FINALIZED")}>Finalized</a></li>
                    </ul>
                </div>
                {filteredOffers[tab].map(offer => <Offer updateOffer={updateOffer} setTab={setTab} key={offer.id} offer={offer} buyer={buyer}></Offer>)}
            </div>
        </div>
    )
}

function Offer({ offer, buyer, updateOffer, setTab }) {
    const ref = useRef();
    const scrollToMe = () => ref.current.scrollIntoView()

    async function acceptOffer() {
        const random = encodeBytes(await getRandomValue(20));
        prompt(`Password for this offer!\nSave it (Ctrl + C)!\nYou will have to use it later!`, random);

        await buyer.acceptOffer(offer.id, random)
            .then(async () => {
                await updateOffer(offer.id);
                setTab("ACCEPTED_BY_BUYER");
                scrollToMe();
                toast.success(`Offer accepted!`);
            })
            .catch(e => toast.error(e.message))

    }

    async function finalizeOffer() {
        const password = prompt(`Please provide password for this offer:`);

        await buyer.finalize(offer.id, password)
            .then(async () => {
                await updateOffer(offer.id);
                setTab("FINALIZED");
                scrollToMe();
                toast.success(`Offer finalized!`);
            })
            .catch(e => toast.error(e.message))

    }

    return (
        <div className={`card mt-2 ${offer.isMarked ? "has-background-warning-light" : ""}`}>
            {/* <div className="card-image">
                        <figure className="image is-4by3">
                            <img src="https://bulma.io/images/placeholders/1280x960.png" alt="Placeholder image" />
                        </figure>
                    </div> */}
            <div className="card-content">
                <div className="media">
                    <div className="media-left">
                        <figure className="image is-128x128">
                            <img src={`https://picsum.photos/128/128?random=${offer.nftContractId}`} alt="Placeholder image" />
                        </figure>
                    </div>

                    <div className="media-content">
                        <div className="field is-grouped is-grouped-multiline">


                            <Tag name={"Stage"} value={offer.stage} />
                            <SonarTag name={"NFT contract id"} type={"contract"} value={offer.nftContractId} />
                            <Tag name={"NFT id"} value={offer.nftId} />
                            <Tag name={"Price"} value={offer.price}></Tag>

                            <div className="control">
                                <div className="tags has-addons">
                                    <a class="tag is-link">Token for payment</a>
                                    <a class="tag" target="_blank" href={`https://polygonscan.com/token/${offer.priceTokenId}`}>{offer.priceTokenId}</a>
                                </div>
                            </div>

                            <SonarTag name={"Contract id"} type={"contract"} value={offer.id} />
                            <SonarTag name="Owner" value={offer.owner} type="creator" />

                            {offer.stage !== "PENDING" ? <Tag name={"Expire at"} value={new Date(offer.expireAt * 1000).toLocaleString()} /> : null}
                            {offer.stage !== "PENDING" ? <Tag name={"Hash of password"} value={offer.hashedPassword} /> : null}
                        </div>
                    </div>
                </div>
            </div>


            {Footer({ stage: offer.stage, acceptOffer, finalizeOffer })}

        </div>
    )
}

function Footer(props) {
    switch (props.stage) {
        case 'PENDING':
            return PendingOfferFooter(props);
        case 'ACCEPTED_BY_BUYER':
            return AcceptedByBuyerFooter(props);
        case 'ACCEPTED_BY_SELLER':
            return AcceptedBySellerFooter(props);
        default:
            return null;
    }
}

function PendingOfferFooter({ acceptOffer }) {
    return (
        <footer class="card-footer">
            <button href="#" class="card-footer-item button outline is-link is-light" onClick={acceptOffer}>Accept Offer</button>
        </footer>
    )
}

function AcceptedByBuyerFooter() {
    const onClick = () => toast.error("Not implemented");
    return (
        <footer class="card-footer">
            <button href="#" class="card-footer-item button outline is-danger is-light" onClick={onClick}>Cancel</button>
        </footer>
    )
}

function AcceptedBySellerFooter({ finalizeOffer }) {
    const onClick = () => toast.error("Not implemented");
    return (
        <footer class="card-footer">
            <button href="#" class="card-footer-item button disabled outline is-success is-light" onClick={finalizeOffer}>Finalize</button>
            <button href="#" class="card-footer-item button outline is-danger is-light" onClick={onClick}>Cancel</button>
        </footer>
    )
}





// const filteredOffers = {
//     "PENDING": initializedOffers.filter(offer => offer.stage === 'PENDING'),
//     "ACCEPTED_BY_BUYER": initializedOffers.filter(offer => offer.stage === 'ACCEPTED_BY_BUYER' && offer.buyer, connection.address),
//     "ACCEPTED_BY_SELLER": initializedOffers.filter(offer => offer.stage === 'ACCEPTED_BY_SELLER' && offer.buyer === connection.address),
//     "FINALIZED": initializedOffers.filter(offer => offer.stage === 'FINALIZED' && offer.buyer === connection.address)
// }

function SonarTag({ name, type, value }) {
    return (
        <div className="control">
            <div className="tags has-addons">
                <a class="tag is-link">{name}</a>
                <a class="tag" target="_blank" href={`https://sonar.warp.cc/?#/app/${type}/${value}`}>{value}</a>
            </div>
        </div>
    )
}

function Tag({ name, value }) {
    return (
        <div className="control">
            <div className="tags has-addons">
                <a class="tag is-success">{name}</a>
                <a class="tag">{value}</a>
            </div>
        </div>
    )
}

