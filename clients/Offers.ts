import { Contract, ethers } from "ethers";
import TeleportEscrowFactory from "./TeleportEscrowFactory";

type FetchedEscrow = {
    id: string
}

function solidityKeccak(value: string) {
    return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [value]));
}

async function fetchEscrowsForOffer(
    evmProvider: ethers.providers.JsonRpcProvider,
    forOfferId: string,
    factoryAddress: string
): Promise<FetchedEscrow[]> {
    const contract = new Contract(factoryAddress, TeleportEscrowFactory.abi, evmProvider);
    const forOfferIdHash = solidityKeccak(forOfferId);
    const filter = contract.filters.NewTeleportEscrow(null, forOfferIdHash)

    const events = await contract.queryFilter(filter);

    return events.map(event => ({
        id: event.args.instance,
    }));
}

async function listenForNewEscrowForOffer(
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

const LIMIT = 5000;
async function fetchAllOffers(
    factoryAddress: string
) {
    const response = await fetch(
        `https://gateway.redstone.finance/gateway/contracts-by-source?id=${factoryAddress}&limit=${LIMIT}`
    ).then(resp => resp.json());

    if (response.pages >= LIMIT) {
        throw Error("Paging not implemented for /gateway/contracts-by-source")
    }

    return response.contracts.map((contract: any) => ({
        id: contract.contractId,
        owner: contract.owner
    }))
}


const evmProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

fetchEscrowsForOffer(
    evmProvider,
    "UgSoCIQigWGKv3pp9brEEpP2Dg4eWqe8nSOMnkF044o",
    "0x36C02dA8a0983159322a80FFE9F24b1acfF8B570"
).then(console.log)

fetchAllOffers(
    "BqQywTrXd-v1hmqsxroUoyugwvz8gy-pkKdUBSd-rPA"
).then(console.log)
