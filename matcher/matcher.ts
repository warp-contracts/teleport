import { Contract, ethers, providers, Signer, Wallet } from "ethers";
import TeleportEscrowFactory from "../client/TeleportEscrowFactory";
import { EventEmitter } from 'node:events';
import { Buyer, Seller } from "../client";
//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { LoggerFactory, WarpFactory } from "warp-contracts";
import * as log from './logger';
import db from './db';
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { subscribeState } from "./warp-pubsub";

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })

const AGGREGATE_NODE_URL = 'https://contracts.warp.cc';

// turn off warp logger
LoggerFactory.INST.logLevel('none');

const BLOCK_LIMIT = 500;
const SEARCH_BLOCKS_IN_PAST = BLOCK_LIMIT * 50;
const AGGREGATE_NODE_POOLING = 1000;

type NewPasswordEvent = {
    offerId: string,
    password: string,
    from: string
}

type NewEscrowEvent = {
    offerId: string
    escrowId: string
}

type InteractionEvent = {
    id: string,
    contract_tx_id: string,
    block_height: number,
    owner_address: string,
    tag_index_0: string,
    tag_index_1: string,
    tag_index_2: string,
    tag_index_3: string,
    tag_index_4: string
}

const markEscrowAsFinalized = (escrowId: string) => db.putSync("FINALIZED_ESCROW_" + escrowId, true);
const isEscrowFinalized = (escrowId: string) => db.get("FINALIZED_ESCROW_" + escrowId);

const markOfferAsAccepted = (offerId: string) => db.putSync("ACCEPTED_OFFER_" + offerId, true);
const isOfferAccepted = (offerId: string) => db.get("ACCEPTED_OFFER_" + offerId);

const markOfferAsFinalized = (offerId: string) => db.putSync("FINALIZED_OFFER_" + offerId, true);
const isOfferFinalized = (offerId: string) => db.get("FINALIZED_OFFER_" + offerId);

const savePassword = (offerId: string, newPasswordEvent: NewPasswordEvent) => db.putSync("PASSWORD_" + offerId, newPasswordEvent);
const getPassword = (offerId: string) => db.get("PASSWORD_" + offerId);
const getAllPasswords = () => db.getRange({ start: "PASSWORD_", end: "PASSWORD_".padEnd(64, 'Z') }).asArray

export async function runListeners(
    wallet: Wallet,
    emitter: EventEmitter,
    evmProviderUrl: string,
    offerSrcTxId: string,
    escrowFactoryAddress: string
) {

    const warp = WarpFactory.forMainnet().use(new EthersExtension());
    const evmProvider = new providers.JsonRpcProvider(evmProviderUrl);

    const seller = new Seller(makeWarpEvmSigner(wallet), warp, evmProvider, wallet.connect(evmProvider), offerSrcTxId);
    const buyer = new Buyer(makeWarpEvmSigner(wallet), warp, evmProvider, wallet.connect(evmProvider), offerSrcTxId, escrowFactoryAddress);

    listenForOfferCreation(emitter, wallet.address);

    const alreadySavedPasswords = getAllPasswords();
    alreadySavedPasswords.forEach(({ key, value }) => {
        emitter.emit('newPassword', value);
    });

    emitter.on('newCreateOfferInteraction', async (interaction: InteractionEvent) => {
        log.info(`NewCreateOfferInteractionEvent ${JSON.stringify(interaction)}`);
        listenForNewEscrowByOfferId(evmProvider, emitter, interaction.contract_tx_id, escrowFactoryAddress)
    });

    emitter.on('newEscrow', async (event: NewEscrowEvent) => {
        log.info(`NewEscrowEvent ${JSON.stringify(event)}`);

        if (isOfferAccepted(event.offerId)) {
            log.info(`Escrow ${event.escrowId} was already handled, skipping`);
            return;
        }

        markOfferAsAccepted(event.offerId);
        await seller.acceptEscrow(event.escrowId, event.offerId)
            .then(() => log.info(`Accepted escrow ${event.escrowId} for offer ${event.offerId}`))
            .catch(e => log.error(`Failed to accept escrow ${event.escrowId} for offer ${event.offerId} : ${e.toString()}`))


        await subscribeState(
            event.offerId,
            async (state) => {
                if (state.stage === "FINALIZED" && !isEscrowFinalized(event.escrowId)) {
                    markEscrowAsFinalized(event.escrowId);
                    await seller.finalize(event.escrowId, event.offerId, state.password)
                        .then(() => log.info(`Seller finalized escrow ${event.escrowId}`))
                        .catch((e) => log.error(`Seller failed to finalize escrow ${event.escrowId} : ${e.toString()}`));
                }
            }
        )
    });

    emitter.on('newPassword', async (event: NewPasswordEvent) => {
        log.info(`NewPasswordEvent ${JSON.stringify(event)}`)

        savePassword(event.offerId, { ...event })

        if (isOfferFinalized(event.offerId)) {
            return;
        }

        await subscribeState(
            event.offerId,
            async (state) => {
                if (state.stage === "ACCEPTED_BY_SELLER" && !isOfferFinalized(event.offerId)) {
                    markOfferAsFinalized(event.offerId)
                    await buyer.finalize(event.offerId, event.password, event.from)
                        .then(() => log.info(`Buyer finalized offer ${event.offerId}`))
                        .catch((e) => log.error(`Buyer failed to finalize offer ${event.offerId}: ${e.toString()}`));
                }
            }
        )
    });
}

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

export async function listenForNewEscrowByOfferId(
    evmProvider: ethers.providers.JsonRpcProvider,
    emitter: EventEmitter,
    forOfferId: string,
    escrowFactoryAddress: string,
): Promise<void> {
    log.info(`Listening for escrows created for offer: ${forOfferId}`);

    const contract = new Contract(escrowFactoryAddress, TeleportEscrowFactory.abi, evmProvider);
    const forOfferIdHash = solidityKeccak(forOfferId);
    const filter = contract.filters.NewTeleportEscrow(null, forOfferIdHash)

    const lastBlock = await evmProvider.getBlockNumber();
    const startBlock = Math.max(lastBlock - SEARCH_BLOCKS_IN_PAST, 0);

    console.assert(lastBlock >= startBlock, "lastBlock should be greater or equal to startBlock")

    log.info(`Searching for preexisting escrows from ${startBlock} to ${lastBlock}`);

    // on already existing
    for (let i = startBlock; i < lastBlock; i += BLOCK_LIMIT) {
        const fromBlock = i;
        const toBlock = i + BLOCK_LIMIT;

        const events = await contract.queryFilter(filter, fromBlock, toBlock);

        events.map(
            e => emitter.emit('newEscrow', { escrowId: e?.args?.instance, offerId: forOfferId })
        )
    }

    // on incoming
    contract.on(filter, (event) => {
        emitter.emit('newEscrow', { escrowId: event?.args?.instance, offerId: forOfferId })
    })
}


async function listenForOfferCreation(emitter: EventEmitter, address: string) {
    const limit = 1000;
    const startPage = 1;

    // TODO: this can be optimized we don't have to fetch all interactions every time
    let i = startPage;
    let lastResponse = await fetchDelegatedCreateOfferInteractions(limit, startPage, address);
    while (true) {
        lastResponse.interactions.map(interaction => {
            if (isOfferAccepted(interaction.contract_tx_id)) {
                log.info(`Skipping create offer interaction ${interaction.contract_tx_id} - already handled`)
            } else {
                emitter.emit('newCreateOfferInteraction', interaction)
            }
        })

        if (lastResponse.paging.items < limit) {
            // when not full page
            const itemsCount = lastResponse.paging.items;
            // waiting for new events
            while (lastResponse.paging.items <= itemsCount) {
                lastResponse = await fetchDelegatedCreateOfferInteractions(limit, i, address);

                await new Promise((resolve, reject) => setTimeout(resolve, AGGREGATE_NODE_POOLING))
            }
            // sorting is done by block_height, so if new interaction has same block height as already saw, it doesnt have to be first in list, so we have to take whole block
        } else {
            // when full page, go to next page
            i++;
        }
    }
}


async function fetchDelegatedCreateOfferInteractions(limit: number, page: number, address: string): Promise<{ paging: { limit: number, items: number, page: number }, interactions: InteractionEvent[] }> {
    while (true) {
        try {
            return await fetch(`${AGGREGATE_NODE_URL}/interactions-by-indexes?limit=${limit}&page=${page}&indexes=TELEPORT_OFFER;DELEGATE-${address}`).then(resp => resp.json());
        } catch (e) {
            continue;
        }
        await new Promise((resolve, reject) => setTimeout(resolve, AGGREGATE_NODE_POOLING));
        break;
    }
} 