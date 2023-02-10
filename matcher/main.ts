import { Contract, ethers, providers, Signer } from "ethers";
import * as lmdb from 'lmdb';
import TeleportEscrowFactory from "../client/TeleportEscrowFactory";
import { EventEmitter } from 'node:events';
import { Buyer, Seller } from "../client";
//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { LoggerFactory, WarpFactory } from "warp-contracts";
import * as log from './logger';
const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })

const WALLET = new ethers.Wallet('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
const AGGREGATE_NODE_URL = 'https://contracts.warp.cc';
const ESCROW_FACTORY_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const OFFER_SRC_TX_ID = "bqLDy8-ZBgoEtnMQN68-rtjuYk00nAOlQPffczYKSIw";

const db = lmdb.open({ path: 'matcher/db' });
LoggerFactory.INST.logLevel('none');


// 1.(manual) seller:: createOffer
// 2.(manual) buyer:: acceptOffer
// 3.(auto) seller:: acceptEscrow(escrowId, offerId)
// 4.(auto) buyer:: finalize(offerId, password) < --------how does he get password
// 5.(auto) seller:: finalize(escrowId, offerId) < 
const BLOCK_LIMIT = 500;
const SEARCH_BLOCKS_IN_PAST = BLOCK_LIMIT * 50;
const AGGREGATE_NODE_POOLING = 500;

async function main() {

    const warp = WarpFactory.forMainnet();
    const evmProvider = new providers.JsonRpcProvider('http://127.0.0.1:8545');
    const emitter = new EventEmitter();
    const seller = new Seller(makeWarpEvmSigner(WALLET), warp, evmProvider, WALLET, OFFER_SRC_TX_ID);
    const buyer = new Buyer(makeWarpEvmSigner(WALLET), warp, evmProvider, WALLET, OFFER_SRC_TX_ID, ESCROW_FACTORY_ADDRESS);

    listenForOfferCreation(emitter);

    emitter.on('newCreateOfferInteraction', async (interaction: InteractionEvent) => {
        log.info(`newCreateOfferInteractionEvent ${JSON.stringify(interaction)}`);
        listenForNewEscrowByOfferId(evmProvider, emitter, interaction.contract_tx_id, ESCROW_FACTORY_ADDRESS)
    });


    emitter.on('newEscrow', async (event: NewEscrowEvent) => {
        log.info(`NewEscrowEvent ${JSON.stringify(event)}`);


        if (db.get("HANDLED_CREATE_" + event.escrowId) === true) {
            log.info(`Escrow ${event.escrowId} was already handled, skipping`);
        } else {
            await seller.acceptEscrow(event.escrowId, event.offerId)
                .then(() => log.info(`Accepted escrow ${event.escrowId} for offer ${event.offerId}`))
                .catch(e => log.error(`Failed to accept escrow ${event.escrowId} for offer ${event.offerId}`))

            await db.put("HANDLED_CREATE_" + event.escrowId, true);
            await db.put("HANDLED_CREATE_" + event.offerId, true);
        }
    });

    // emitter.on('newAcceptOfferInteraction', async (event) => {

    // });
}

main();

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

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

export async function listForOfferAcceptedBySeller(
    evmProvider: ethers.providers.JsonRpcProvider,
    emitter: EventEmitter,
    forOfferId: string,
) {

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


async function listenForOfferCreation(emitter: EventEmitter) {
    const limit = 1000;
    const startPage = 1;

    // TODO: this can be optimized we don't have to fetch all interactions every time
    let i = startPage;
    let lastResponse = await fetchDelegatedCreateOfferInteractions(limit, startPage);
    while (true) {
        lastResponse.interactions.map(interaction => {
            if (db.get("HANDLED_CREATE_" + interaction.contract_tx_id)) {
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
                lastResponse = await fetchDelegatedCreateOfferInteractions(limit, i);

                await new Promise((resolve, reject) => setTimeout(resolve, AGGREGATE_NODE_POOLING))
            }
            // sorting is done by block_height, so if new interaction has same block height as already saw, it doesnt have to be first in list, so we have to take whole block
        } else {
            // when full page, go to next page
            i++;
        }
    }
}


async function fetchDelegatedCreateOfferInteractions(limit: number, page: number): Promise<{ paging: { limit: number, items: number, page: number }, interactions: InteractionEvent[] }> {
    return await fetch(`${AGGREGATE_NODE_URL}/interactions-by-indexes?limit=${limit}&page=${page}&indexes=TELEPORT_OFFER;DELEGATE-${WALLET.address}`).then(resp => resp.json());
}

async function listenForOfferAcceptance(emitter: EventEmitter) {
    const limit = 1000;
    const startPage = 1;

    let i = startPage;
    let lastResponse = await fetchDelegatedAcceptOfferInteractions(limit, i);

    while (true) {
        lastResponse.interactions.map(interaction => {
            if (db.get("HANDLED_ACCEPT_" + interaction.contract_tx_id)) {
                log.info(`Skipping accept offer interaction ${interaction.contract_tx_id} - already handled`)
            } else {
                emitter.emit('newAcceptOfferInteraction', interaction);
            }
        })

        if (lastResponse.paging.items < limit) {
            // when not full page
            const itemsCount = lastResponse.paging.items;
            // waiting for new events
            while (lastResponse.paging.items <= itemsCount) {
                lastResponse = await fetchDelegatedAcceptOfferInteractions(limit, i);
                await new Promise((resolve, reject) => setTimeout(resolve, AGGREGATE_NODE_POOLING))
            }
        } else {
            // when full page, go to next page
            i++;
        }
    }
}

async function fetchDelegatedAcceptOfferInteractions(limit: number, page: number): Promise<{ paging: { limit: number, items: number, page: number }, interactions: InteractionEvent[] }> {
    return await fetch(`${AGGREGATE_NODE_URL}/interactions-by-indexes?limit=${limit}&page=${page}&indexes=ACCEPT_TELEPORT_OFFER;DELEGATE-${WALLET.address}`).then(resp => resp.json());
}
