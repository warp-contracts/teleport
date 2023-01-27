import toast from 'react-hot-toast';
import * as fetcher from './client/Offers';
import { Buyer } from './client/Buyer';
import { Seller } from './client/Seller';
import { useEffect, useState, useRef } from 'react';
import { getRandomValue, encodeBytes } from './random';
import TeleportEscrow from './client/TeleportEscrow';
import { ethers } from 'ethers';

const ESCROW_STAGES = {
    0: "PENDING",
    1: "CANCELED",
    2: "FINALIZED"
}

export function OfferList({ connection }) {
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("PENDING");
    const buyer = new Buyer(
        { signer: connection.evmSignature, type: 'ethereum' },
        connection.warp,
        connection.evmProvider,
        connection.signer
    );

    const seller = new Seller(
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

    async function withEscrow(offer) {
        if (offer.stage === "PENDING") {
            return offer;
        } else {
            const escrows = await fetcher.fetchEscrowsByOfferId(
                connection.evmProvider,
                offer.id,
            );

            if (escrows.length === 0) {
                return { ...offer, escrowAddress: "missing" }
            }

            const escrow = escrows[0];

            const escrowContract = new ethers.Contract(escrow.id, TeleportEscrow.abi, connection.evmProvider);

            return {
                ...offer,
                escrowAddress: escrow.id,
                escrowStage: ESCROW_STAGES[await escrowContract.stage()],
                escrowExpireAt: (await escrowContract.expireAt()).toNumber()
            }
        }
    }

    async function init() {
        const contracts = await fetcher.fetchAllOffersId(100)
            .then(
                response => fetcher.batchEvaluateOffers(connection.warp, response.contracts, 100)
            )
            .then(
                offers => Promise.all(offers.map(withEscrow))
            )
            .then(setOffers);
        setLoading(false);

        return contracts;
    }

    useEffect(() => {
        init()
    }, [setOffers]);

    const updateOffer = async (offerId) => {
        const { cachedValue: { state } } = await connection.warp.contract(offerId).readState();
        const offer = await withEscrow({ ...state, id: offerId });
        setOffers(offers.map(o => {
            if (o.id === offerId) {
                return { ...o, ...offer, isMarked: true };
            }
            return o;
        }))
    }

    const addOffer = async (offerId) => {
        const { cachedValue: { state } } = await connection.warp.contract(offerId).readState();

        setOffers(prev => [...prev, { ...state, id: offerId, isMarked: true }]);
        setTab("PENDING");
    }

    return (
        <div>
            <h1 className="title has-text-centered">Offer List</h1>
            <h2 className="subtitle has-text-centered">
                Here you can buy NFTs from arweave, and pay for them using ERC20 tokens on Polygon.
            </h2>
            <CreateOfferModal seller={seller} address={connection.address} addOffer={addOffer}></CreateOfferModal>
            <div className="box">
                <div className="tabs">
                    <ul>
                        <li className={tab === "PENDING" ? "is-active" : ""}><a onClick={() => setTab("PENDING")}>Pending</a></li>
                        <li className={tab === "ACCEPTED_BY_BUYER" ? "is-active" : ""}><a onClick={() => setTab("ACCEPTED_BY_BUYER")}>Accepted by buyer</a></li>
                        <li className={tab === "ACCEPTED_BY_SELLER" ? "is-active" : ""}><a onClick={() => setTab("ACCEPTED_BY_SELLER")}>Accepted by seller</a></li>
                        <li className={tab === "FINALIZED" ? "is-active" : ""}><a onClick={() => setTab("FINALIZED")}>Finalized</a></li>
                    </ul>
                </div>
                {loading ? <div class="box has-text-centered">Loading...</div> :
                    filteredOffers[tab].map(offer => <Offer address={connection.address} updateOffer={updateOffer} setTab={setTab} key={offer.id} offer={offer} buyer={buyer} seller={seller}></Offer>)
                }
            </div>
        </div>
    )
}

function Offer({ offer, seller, buyer, updateOffer, setTab, address }) {
    const myRef = useRef(null)

    const scrollToMe = () => myRef.current.scrollIntoView()

    async function acceptOffer() {
        let password = encodeBytes(await getRandomValue(20));
        password = prompt(`Password for this offer!\nSave it (Ctrl + C)!\nYou will have to use it later!`, password);
        if (password === null) {
            return;
        }

        await buyer.acceptOffer(offer.id, password)
            .then(async () => {
                await updateOffer(offer.id);
                setTab("ACCEPTED_BY_BUYER");
                toast.success(`Offer accepted!`);
                scrollToMe();
            })
            .catch(e => toast.error(e.message))

    }

    async function finalizeOffer() {
        const password = prompt(`Please provide password for this offer:`);

        await buyer.finalize(offer.id, password)
            .then(async () => {
                await updateOffer(offer.id);
                setTab("FINALIZED");
                toast.success(`Offer finalized!`);
            })
            .catch(e => toast.error(e.message))
    }

    async function acceptEscrow() {
        if (!offer.escrowAddress) {
            toast.error("Offer doesn't have assigned escrow!")
            return;
        }
        await seller.acceptEscrow(offer.escrowAddress, offer.id)
            .then(async () => {
                await updateOffer(offer.id);
                setTab("ACCEPTED_BY_SELLER");
                toast.success("Escrow accepted!");
            })
            .catch(e => toast.error(e.message))
    }

    async function finalizeEscrow() {
        await seller.finalize(offer.escrowAddress, offer.id)
            .then(async () => {
                await updateOffer(offer.id);
                toast.success("Escrow finalized!");
            })
            .catch(e => toast.error(e.message))
    }

    return (
        <div ref={myRef} className={`card mt-4 ${offer.isMarked ? "has-background-warning-light" : ""}`}>
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
                            <SonarTag name="Creator" value={offer.creator} type="creator" />
                            <SonarTag name="Receiver" value={offer.owner} type="creator" />

                            {offer.stage !== "PENDING" ? <>
                                <Tag name={"Expire at"} value={new Date(offer.expireAt * 1000).toLocaleString()} />
                                <Tag name={"Hash of password"} value={offer.hashedPassword} />
                                <div className="control">
                                    <div className="tags has-addons">
                                        <a class="tag is-link">Escrow</a>
                                        <a class="tag" target="_blank" href={`https://polygonscan.com/address/${offer.escrowAddress}`}>{offer.escrowAddress}</a>
                                    </div>
                                </div>
                                <Tag name={"Escrow stage"} value={offer.escrowStage} />
                                <Tag name={"Escrow expire at"} value={new Date(offer.escrowExpireAt * 1000).toLocaleString()} />
                            </> : null}

                        </div>
                    </div>
                </div>
            </div>


            {Footer({
                stage: offer.stage, acceptOffer, finalizeOffer, offer, acceptEscrow, address, finalizeEscrow
            })}

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
        case 'FINALIZED':
            return FinalizedFooter(props);
        default:
            return null;
    }
}

function FinalizedFooter({ finalizeEscrow, offer }) {
    if (offer.escrowStage === "FINALIZED") {
        return null;
    }

    return (
        <footer class="card-footer">
            <button href="#" class="card-footer-item button outline is-link is-light" onClick={finalizeEscrow}>Finalize escrow</button>
        </footer>
    )
}

function PendingOfferFooter({ acceptOffer }) {
    return (
        <footer class="card-footer">
            <button href="#" class="card-footer-item button outline is-link is-light" onClick={acceptOffer}>Accept Offer</button>
        </footer>
    )
}

function AcceptedByBuyerFooter({ offer, address, acceptEscrow }) {
    const onClick = () => toast.error("Not implemented");

    return (
        <footer class="card-footer">
            {offer.owner === address ? <button href="#" class="card-footer-item button outline is-info is-light" onClick={acceptEscrow}>Accept Escrow</button> : null}
            {offer.owner === address ? <button href="#" class="card-footer-item button outline is-danger is-light" onClick={onClick}>Cancel</button> : null}
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

function CreateOfferModal({ seller, addOffer, address }) {
    const [active, setActive] = useState(false);
    const [formData, setFormData] = useState({
        nftContractId: "",
        nftId: "",
        price: "",
        priceTokenId: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        receiver: address
    });

    const submitOffer = async () => {
        await seller.createOffer(
            formData.nftContractId,
            formData.nftId,
            formData.price.toString(),
            formData.priceTokenId,
            formData.receiver
        )
            .then(({ offerId }) => {
                addOffer(offerId);
                toast.success("Created new offer!")
                setActive(false);
                setFormData({
                    nftContractId: "",
                    nftId: "",
                    price: "",
                    priceTokenId: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                    receiver: address
                })
            })
            .catch(err => toast.error(err.message))
    };


    return (
        <div className='mb-4'>
            <button className="button is-large is-light is-success" onClick={() => setActive(true)}>
                <span class="icon is-small">
                    <i class="fa-solid fa-plus"></i>
                </span>
                <span>Create offer</span>
            </button>
            <div class={`modal ${active ? "is-active" : ""}`}>
                <div class="modal-background"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">Create offer</p>
                        <button class="delete" aria-label="close" onClick={() => setActive(false)}></button>
                    </header>
                    <section class="modal-card-body">

                        <div class="field">
                            <label class="label">NFT contract id</label>
                            <div class="control">
                                <input class="input" type="text" onChange={e => setFormData({ ...formData, nftContractId: e.target.value })} value={formData.nftContractId} placeholder="NFT contract id" />
                            </div>
                        </div>

                        <div class="field">
                            <label class="label">NFT id</label>
                            <div class="control">
                                <input class="input" type="text" onChange={e => setFormData({ ...formData, nftId: e.target.value })} value={formData.nftId} placeholder="NFT id" />
                            </div>
                        </div>

                        <div class="field">
                            <label class="label">Payment in token</label>
                            <div class="select">
                                <select onChange={e => setFormData({ ...formData, priceTokenId: e.target.value.split('-')[1] })}>
                                    <option >USDT-0x5FbDB2315678afecb367f032d93F642f64180aa3</option>
                                    <option >USDT-test</option>
                                </select>
                            </div>
                        </div>

                        <div class="field">
                            <label class="label">Price</label>
                            <div class="control">
                                <input class="input" type="number" onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} value={formData.price} placeholder="Price" />
                            </div>
                        </div>

                        <div class="field">
                            <label class="label">Receiver</label>
                            <div class="control">
                                <input class="input" type="text" onChange={e => setFormData({ ...formData, receiver: e.target.value })} value={formData.receiver} />
                            </div>
                        </div>

                    </section>
                    <footer class="modal-card-foot">
                        <button class="button is-success" onClick={submitOffer}>Create</button>
                        <button class="button" onClick={() => setActive(false)}>Cancel</button>
                    </footer>
                </div>
            </div>
        </div>
    )
}

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

