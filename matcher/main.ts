import { ethers } from "ethers";
import { EventEmitter } from "koa";
import { LoggerFactory } from "warp-contracts";
import { runListeners } from "./matcher";
import { buildServer } from "./server";

const WALLET = new ethers.Wallet('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');
const EVM_PROVIDER_URL = "http://127.0.0.1:8545";
const ESCROW_FACTORY_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
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