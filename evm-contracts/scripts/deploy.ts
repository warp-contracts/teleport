import { ethers } from "hardhat";

async function main() {
  const Erc20 = await ethers.getContractFactory("TestERC20");
  const erc20 = await Erc20.deploy();

  const [owner] = await ethers.getSigners();

  await erc20.deployed();
  console.log("ERC20 address: ", erc20.address)

  await erc20.testMint("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 100_000_000);
  await erc20.testMint("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 100_000_000);
  await erc20.testMint("0xf4E7D568aB9720f432B6d2C30f25D9c26222F302", 100_000_000);
  await erc20.testMint("0x96561f9127d36c43e863067e654cA51f08ea6f33", 100_000_000);
  console.log("Minted test token");

  const EscrowMaster = await ethers.getContractFactory("TeleportEscrow");
  const escrowMaster = await EscrowMaster.deploy();
  console.log("Deployed master escrow: ", escrowMaster.address);

  const TeleportEscrowFactory = await ethers.getContractFactory("TeleportEscrowFactory");
  const teleportEscrowFactory = await TeleportEscrowFactory.deploy(escrowMaster.address);
  console.log("Deployed escrow factory: ", teleportEscrowFactory.address);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
