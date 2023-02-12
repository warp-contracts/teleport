import { Contract, ethers, providers, Signer } from "ethers";
import TeleportEscrowFactory from "../client/TeleportEscrowFactory";
import { EventEmitter } from 'node:events';
import { Buyer, Seller } from "../client";
//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { LoggerFactory, WarpFactory } from "warp-contracts";
import * as log from './logger';
import db from './db';
import { buildServer } from "./server";
import WebSocket from 'ws';
import { initPubSub, subscribe } from "warp-contracts-pubsub";
import { EthersExtension } from "warp-contracts-plugin-ethers";

global.WebSocket = WebSocket as any;
initPubSub();

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })

const WALLET = new ethers.Wallet('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
const AGGREGATE_NODE_URL = 'https://contracts.warp.cc';
const ESCROW_FACTORY_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const OFFER_SRC_TX_ID = "bqLDy8-ZBgoEtnMQN68-rtjuYk00nAOlQPffczYKSIw";

LoggerFactory.INST.logLevel('none');


const BLOCK_LIMIT = 500;
const SEARCH_BLOCKS_IN_PAST = BLOCK_LIMIT * 50;
const AGGREGATE_NODE_POOLING = 500;

async function main() {

    const warp = WarpFactory.forMainnet().use(new EthersExtension());
    const evmProvider = new providers.JsonRpcProvider("http://127.0.0.1:8545");

    const emitter = new EventEmitter();

    const server = buildServer(emitter);
    server.listen(8989);

    const seller = new Seller(makeWarpEvmSigner(WALLET), warp, evmProvider, WALLET.connect(evmProvider), OFFER_SRC_TX_ID);
    const buyer = new Buyer(makeWarpEvmSigner(WALLET), warp, evmProvider, WALLET.connect(evmProvider), OFFER_SRC_TX_ID, ESCROW_FACTORY_ADDRESS);

    listenForOfferCreation(emitter);

    emitter.on('newCreateOfferInteraction', async (interaction: InteractionEvent) => {
        log.info(`NewCreateOfferInteractionEvent ${JSON.stringify(interaction)}`);
        listenForNewEscrowByOfferId(evmProvider, emitter, interaction.contract_tx_id, ESCROW_FACTORY_ADDRESS)
    });

    emitter.on('newEscrow', async (event: NewEscrowEvent) => {
        log.info(`NewEscrowEvent ${JSON.stringify(event)}`);

        if (db.get("HANDLED_CREATE_" + event.offerId) === true) {
            log.info(`Escrow ${event.escrowId} was already handled, skipping`);
        } else {
            await seller.acceptEscrow(event.escrowId, event.offerId)
                .then(() => log.info(`Accepted escrow ${event.escrowId} for offer ${event.offerId}`))
                .catch(e => log.error(`Failed to accept escrow ${event.escrowId} for offer ${event.offerId} : ${e.toString()}`))

            await db.put("HANDLED_CREATE_" + event.offerId, true);

            await subscribe(`states/${event.offerId}`,
                async ({ data }: { data: string }) => {
                    const { state } = JSON.parse(data);
                    if (state.stage === "FINALIZED" && !(db.get("FINALIZED_ESCROW_" + event.escrowId))) {
                        db.putSync("FINALIZED_ESCROW_" + event.escrowId, true);
                        await seller.finalize(event.escrowId, event.offerId, state.password)
                            .then(() => log.info(`Seller finalized escrow ${event.escrowId}`))
                            .catch((e) => log.error(`Seller failed to finalize escrow ${event.escrowId} : ${e.toString()}`));
                    }
                },
                (e: any) => log.error(e.error.errors)
            );
        }
    });

    emitter.on('newPassword', async (event: NewPasswordEvent) => {
        log.info(`NewPasswordEvent ${JSON.stringify(event)}`)
        if (!db.get("PASSWORD_" + event.offerId)) {
            db.put("PASSWORD_" + event.offerId, event.password)
            await subscribe(`states/${event.offerId}`,
                async ({ data }: { data: string }) => {
                    const { state } = JSON.parse(data);
                    if (state.stage === "ACCEPTED_BY_SELLER" && !(db.get("FINALIZED_OFFER_" + event.offerId))) {
                        db.putSync("FINALIZED_OFFER_" + event.offerId, true)
                        await buyer.finalize(event.offerId, event.password, event.from)
                            .then(() => log.info(`Buyer finalized offer ${event.offerId}`))
                            .catch((e) => log.error(`Buyer failed to finalize offer ${event.offerId}: ${e.toString()}`));
                    }
                },
                (e: any) => log.error(e.error.errors)
            );
        }
    });
}

main();

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