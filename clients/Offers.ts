import { Contract, ethers } from "ethers";
import { Warp } from "warp-contracts";
import { ESCROW_FACTORY_ADDRESS } from "./Constants";
import TeleportEscrowFactory from "./TeleportEscrowFactory";

type FetchedEscrow = {
    id: string
}

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

export async function fetchEscrowsForOffer(
    evmProvider: ethers.providers.JsonRpcProvider,
    forOfferId: string,
    factoryAddress: string
): Promise<FetchedEscrow[]> {
    const contract = new Contract(factoryAddress, TeleportEscrowFactory.abi, evmProvider);
    const forOfferIdHash = solidityKeccak(forOfferId);
    const filter = contract.filters.NewTeleportEscrow(null, forOfferIdHash)

    const events = await contract.queryFilter(filter);

    return events.map(event => ({
        id: event?.args?.instance,
    }));
}

export async function listenForNewEscrowForOffer(
    evmProvider: ethers.providers.JsonRpcProvider,
    forOfferId: string,
    listener: (escrow: FetchedEscrow) => void,
    factoryAddress: string
) {
    const contract = new Contract(factoryAddress, TeleportEscrowFactory.abi, evmProvider);
    const forOfferIdHash = solidityKeccak(forOfferId);
    const filter = contract.filters.NewTeleportEscrow(null, forOfferIdHash)

    contract.on(filter, listener)
}

// export async fetchEscrowPassword(
//     evmProvider: ethers.providers.J
// ) {

// }

export async function fetchAllOffers(
    factoryAddress: string,
    warp: Warp,
    limit = 10
) {
    const response = await fetch(
        `https://gateway.redstone.finance/gateway/contracts-by-source?id=${factoryAddress}&limit=${limit}`
    ).then(resp => resp.json());

    if (response.pages >= limit) {
        throw Error("Paging not implemented for /gateway/contracts-by-source")
    }

    const all = [];
    if (warp) {
        const batchSize = 10;
        let promises = [];
        for (let i = 0; i < response.contracts.length; i++) {

            const result = warp.contract(response.contracts[i].contractId)
                .setEvaluationOptions({ internalWrites: true })
                .readState()
                .then((value: any) => ({
                    ...value.cachedValue.state,
                    id: response.contracts[i].contractId,
                    creator: response.contracts[i].owner
                }));


            promises.push(result)
            if (i % batchSize === batchSize - 1) {
                all.push(...(await Promise.all(promises)))
                promises = [];
            }
        }
    }

    return all;
}


