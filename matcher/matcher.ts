import { Contract, ethers, logger, providers, Signer, Wallet } from "ethers";
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
import ERC20 from "../client/ERC20";

const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })

// turn off warp logger
LoggerFactory.INST.logLevel('none');

const BLOCK_LIMIT = 500;

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

    const alreadySavedPasswords = getAllPasswords();
    alreadySavedPasswords.forEach(({ key, value }) => {
        emitter.emit('newPassword', value);
    });

    emitter.on('trackSeller', (event) => {
        log.info(`trackSeller ${JSON.stringify(event)}`)
        db.putSync("OFFER_NEW_" + solidityKeccak(event.offerId), event.offerId)
    })

    listenForNewEscrows(evmProvider, emitter, escrowFactoryAddress)
    evmProvider.on("block", (event) => {
        listenForNewEscrows(evmProvider, emitter, escrowFactoryAddress)
    });

    emitter.on('newEscrow', async (event: NewEscrowEvent) => {
        log.info(`NewEscrowEvent ${JSON.stringify(event)}`);

        if (isOfferAccepted(event.offerId)) {
            return;
        }

        markOfferAsAccepted(event.offerId);
        await new Promise((resolve, reject) => setTimeout(resolve, 10_000)); // should wait normally on funding

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

    emitter.on('trackBuyer', async (event: NewPasswordEvent) => {
        log.info(`trackBuyer ${JSON.stringify(event)}`)

        savePassword(event.offerId, { ...event })

        if (isOfferFinalized(event.offerId)) {
            return;
        }

        await subscribeState(
            event.offerId,
            async (state) => {
                if (state.stage === "ACCEPTED_BY_SELLER" && !isOfferFinalized(event.offerId)) {
                    markOfferAsFinalized(event.offerId)
                    console.log({ password: event.password })
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

async function listenForNewEscrows(
    evmProvider: ethers.providers.JsonRpcProvider,
    emitter: EventEmitter,
    escrowFactoryAddress: string,
): Promise<void> {
    log.info(`Listening for new escrows created by factor: ${escrowFactoryAddress}`);

    const contract = new Contract(escrowFactoryAddress, TeleportEscrowFactory.abi, evmProvider);

    const lastBlock = await evmProvider.getBlockNumber();
    const startBlock = db.get("LAST_ESCROW_BLOCK") ?? Math.max(lastBlock - 500, 0);

    console.assert(lastBlock >= startBlock, "lastBlock should be greater or equal to startBlock")
    log.info(`Searching for escrows from ${startBlock} to ${lastBlock}`);

    for (let i = startBlock; i < lastBlock; i += BLOCK_LIMIT) {
        const fromBlock = i;
        const toBlock = i + BLOCK_LIMIT;

        const events = await contract.queryFilter("NewTeleportEscrow", fromBlock, toBlock);

        // if we are tracking this offer
        events.map(
            e => {
                const offerIdHash = e?.args?.offerIdHash;
                const offerId = db.get("OFFER_NEW_" + offerIdHash);
                if (offerId) {
                    emitter.emit('newEscrow', { escrowId: e?.args?.instance, offerId })
                }
            }
        )
        db.putSync("LAST_ESCROW_BLOCK", Math.max(lastBlock, i));
    }
}
