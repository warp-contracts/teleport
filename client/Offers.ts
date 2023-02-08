import { Contract, ethers } from "ethers";
import { Warp } from "warp-contracts";
import TeleportEscrowFactory from "./TeleportEscrowFactory";

type FetchedEscrow = {
    id: string
}

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}


const BLOCK_LIMIT = 999;
export async function fetchEscrowsByOfferId(
    evmProvider: ethers.providers.JsonRpcProvider,
    forOfferId: string,
    escrowFactoryAddress: string
): Promise<FetchedEscrow[]> {
    const contract = new Contract(escrowFactoryAddress, TeleportEscrowFactory.abi, evmProvider);
    const forOfferIdHash = solidityKeccak(forOfferId);
    const filter = contract.filters.NewTeleportEscrow(null, forOfferIdHash)

    const lastBlock = await evmProvider.getBlockNumber();
    const firstBlock = lastBlock - (BLOCK_LIMIT * 6); // 1000 blocks * 2 seconds * 6 => 12_000 second ~ 3 hours

    const allEvents: ethers.Event[] = [];
    for (let i = firstBlock; i <= lastBlock; i += BLOCK_LIMIT) {
        const fromBlock = '0x' + (i - BLOCK_LIMIT).toString(16);
        const toBlock = '0x' + (i).toString(16);

        const events = await contract.queryFilter(filter, fromBlock, toBlock);

        allEvents.push(...events);
    }

    return allEvents.map(event => ({
        id: event?.args?.instance,
    }));
}

export async function listenForNewEscrowByOfferId(
    evmProvider: ethers.providers.JsonRpcProvider,
    forOfferId: string,
    listener: (escrow: FetchedEscrow) => void,
    escrowFactoryAddress: string
) {
    const contract = new Contract(escrowFactoryAddress, TeleportEscrowFactory.abi, evmProvider);
    const forOfferIdHash = solidityKeccak(forOfferId);
    const filter = contract.filters.NewTeleportEscrow(null, forOfferIdHash)

    contract.on(filter, listener)
}

type ContractBySource = {
    "contractId": string,
    "owner": string,
    "bundlerTxId": string,
    "blockHeight": number,
    "blockTimestamp": string,
    "interactions": string
}

export async function fetchAllOffersId(
    offerSrcTxId: string,
    limit = 5000,
): Promise<{ contracts: ContractBySource[], pages: any }> {

    const response = await fetch(
        `https://gateway.warp.cc/gateway/contracts-by-source?id=${offerSrcTxId}&limit=${limit}&sort=desc`
    ).then(resp => resp.json());

    if (response.paging.total >= limit) {
        throw Error("Paging not implemented for /gateway/contracts-by-source")
    }

    return response;
}

export async function batchEvaluateOffers(warp: Warp, contracts: ContractBySource[], batchSize = 10) {
    const all = [];
    let promises = [];
    for (let i = 0; i < contracts.length; i++) {
        const result = warp.contract(contracts[i].contractId)
            .setEvaluationOptions({ internalWrites: true })
            .readState()
            .then((value: any) => ({
                ...value.cachedValue.state,
                id: contracts[i].contractId,
                creator: contracts[i].owner
            }));

        promises.push(result);

        if (i % batchSize === batchSize - 1) {
            all.push(...(await Promise.all(promises)));
            promises = [];
        }
    }

    all.push(...(await Promise.all(promises)));

    return all;
}
