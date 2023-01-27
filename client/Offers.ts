import { Contract, ethers } from "ethers";
import { Warp } from "warp-contracts";
import { ESCROW_FACTORY_ADDRESS, TRUSTED_OFFER_SRC_TX_ID } from "./Constants";
import TeleportEscrowFactory from "./TeleportEscrowFactory";

type FetchedEscrow = {
    id: string
}

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

export async function fetchEscrowsByOfferId(
    evmProvider: ethers.providers.JsonRpcProvider,
    forOfferId: string,
): Promise<FetchedEscrow[]> {
    const contract = new Contract(ESCROW_FACTORY_ADDRESS, TeleportEscrowFactory.abi, evmProvider);
    const forOfferIdHash = solidityKeccak(forOfferId);
    const filter = contract.filters.NewTeleportEscrow(null, forOfferIdHash)

    const events = await contract.queryFilter(filter);

    return events.map(event => ({
        id: event?.args?.instance,
    }));
}

export async function listenForNewEscrowByOfferId(
    evmProvider: ethers.providers.JsonRpcProvider,
    forOfferId: string,
    listener: (escrow: FetchedEscrow) => void,
) {
    const contract = new Contract(ESCROW_FACTORY_ADDRESS, TeleportEscrowFactory.abi, evmProvider);
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
    limit = 5000
): Promise<{ contracts: ContractBySource[], pages: any }> {

    const response = await fetch(
        `https://gateway.redstone.finance/gateway/contracts-by-source?id=${TRUSTED_OFFER_SRC_TX_ID}&limit=${limit}&sort=desc`
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
