import { Seller } from "../client/Seller";
//@ts-ignore
import { buildEvmSignature } from 'warp-contracts-plugin-signature/server';
import { ethers, Signer } from "ethers";
import { WarpFactory } from "warp-contracts";
import { EthersExtension } from "warp-contracts-plugin-ethers";
import { Buyer } from "../client/Buyer";
import { deployNft } from "./Nft";

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
];
const ESCROW_FACTORY_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const TEST_PAYMENT_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const OFFER_SRC_TX_ID = "j-9bfYEq0wFx81EcV6-ElLH_mnNlATl7z4auwMqzLR0";
const makeWarpEvmSigner = (ethersSigner: Signer) => ({ signer: buildEvmSignature(ethersSigner), type: 'ethereum' as const })

async function main() {
    // set-up
    const ALICE = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    const BOB = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
    const evmProvider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    const erc20 = new ethers.Contract(TEST_PAYMENT_TOKEN, ERC20_ABI, evmProvider);

    console.log("ALICE: ", ALICE.address);
    console.log("BOB: ", BOB.address);

    console.log("ALICE BALANCE ", (await erc20.balanceOf(ALICE.address)).toNumber());


    const warp = WarpFactory
        .forMainnet()
        .use(new EthersExtension());

    const ALICE_NFT = await deployNft(warp, makeWarpEvmSigner(ALICE));
    const { result: ownerBefore } = await ALICE_NFT.nftContract.viewState({ function: 'ownerOf', tokenId: ALICE_NFT.nftId })
    console.log("NFT owner: ", ownerBefore);
    // end of set-up

    const seller = new Seller(makeWarpEvmSigner(ALICE), warp, evmProvider, ALICE.connect(evmProvider), OFFER_SRC_TX_ID);
    const buyer = new Buyer(makeWarpEvmSigner(BOB), warp, evmProvider, BOB.connect(evmProvider), OFFER_SRC_TX_ID, ESCROW_FACTORY_ADDRESS)

    const { offerId } = await seller.createOffer(
        ALICE_NFT.contractTxId,
        ALICE_NFT.nftId,
        '10',
        TEST_PAYMENT_TOKEN
    );
    console.log(`Seller: Created offer ${offerId} for NFT: ${ALICE_NFT.contractTxId}:${ALICE_NFT.nftId} for price 10 paid in token ${TEST_PAYMENT_TOKEN}`)

    const { escrowId } = await buyer.acceptOffer(offerId, "password");
    console.log(`Buyer: Accepted offer ${offerId} and secured it by escrow ${escrowId}`)

    await seller.acceptEscrow(escrowId, offerId); // mozna zautomatyzowac
    console.log(`Seller: Accepted ${escrowId}`)

    await buyer.finalize(offerId, "password");
    console.log(`Buyer: Finalized offer and revealed password: password`)

    await seller.finalize(escrowId, offerId)
    console.log(`Seller: Withdraw money from escrow using revealed password`)

    console.log("ALICE BALANCE ", (await erc20.balanceOf(ALICE.address)).toNumber());

    const { result: ownerAfter } = await ALICE_NFT.nftContract.viewState({ function: 'ownerOf', tokenId: ALICE_NFT.nftId })
    console.log("NFT owner: ", ownerAfter);
}

main()
