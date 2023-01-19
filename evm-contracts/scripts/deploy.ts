import { ethers } from "hardhat";

async function main() {
  const Erc20 = await ethers.getContractFactory("TestERC20");
  const erc20 = await Erc20.deploy();

  const [owner] = await ethers.getSigners();

  await erc20.deployed();
  console.log("ERC20 address: ", erc20.address)

  await erc20.testMint("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 100);
  await erc20.testMint("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 100);
  console.log(`Minted 100 to`)
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
