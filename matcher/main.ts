import { ethers } from "ethers";
import { EventEmitter } from "koa";
import { LoggerFactory } from "warp-contracts";
import { runListeners } from "./matcher";
import { buildServer } from "./server";

const WALLET = new ethers.Wallet('0x618088ac0a80d378b2ead0083c118b8750cce2251cb57fd18b8cfa80bb9bd85c');
const EVM_PROVIDER_URL = "https://polygon-testnet.blastapi.io/53170129-11ad-4ed7-b6a9-e9ea47575c0c";
const ESCROW_FACTORY_ADDRESS = '0x464204f2315388b42486E9E8b4a1A35714FA6d62';
const OFFER_SRC_TX_ID = "bqLDy8-ZBgoEtnMQN68-rtjuYk00nAOlQPffczYKSIw";

// turn off warp logger
LoggerFactory.INST.logLevel('none');

const emitter = new EventEmitter();

const server = buildServer(emitter);
server.listen(8989);

runListeners(
    WALLET,
    emitter,
    EVM_PROVIDER_URL,
    OFFER_SRC_TX_ID,
    ESCROW_FACTORY_ADDRESS
);