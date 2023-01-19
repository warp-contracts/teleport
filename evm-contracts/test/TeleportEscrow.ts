import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

enum EscrowStages {
  PENDING = 0,
  FUNDED = 1,
  CANCELED = 2,
  FINALIZED = 3
}

describe("TeleportEscrow", function () {

  async function deploy(
  ) {
    const [owner, otherAccount] = await ethers.getSigners();

    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const erc20 = await TestERC20.deploy();

    await erc20.testMint(owner.address, 20);
    await erc20.testMint(otherAccount.address, 20);

    const lockTime = 3600;
    const receiver = otherAccount.address;

    const encodeString = ethers.utils.defaultAbiCoder.encode(["string"], ["ala_ma_kota"])
    const hashedPassword = ethers.utils.keccak256(encodeString);
    const amount = 10;
    const token = erc20.address;

    const TeleportEscrow = await ethers.getContractFactory("TeleportEscrow");
    const escrow = await TeleportEscrow.deploy(
      lockTime,
      receiver,
      hashedPassword,
      amount,
      token
    );

    return { escrow, owner, otherAccount, erc20, lockTime, receiver, hashedPassword, amount, token };
  }

  async function deployAndFund() {
    const result = await deploy();
    await result.erc20.transfer(result.escrow.address, 10);

    await result.escrow.markAsFunded();

    return result;
  }

  describe("Deployment", function () {
    it("Should deploy contract", async function () {
      await loadFixture(deploy);
    });
  });

  describe("Funding", function () {
    it("Should fail to mark contract as funded, if token were NOT sent", async () => {
      const { escrow } = await loadFixture(deploy);

      await expect(escrow.markAsFunded()).to.be.revertedWith(
        "To mark as funded contract has to posses tokens"
      );
    });

    it("Should mark contract as funded, if token were sent", async () => {
      const { escrow, erc20 } = await loadFixture(deploy);

      await erc20.transfer(escrow.address, 10);

      await escrow.markAsFunded();

      expect(await escrow.stage()).to.eq(EscrowStages.FUNDED);
      expect(await erc20.balanceOf(escrow.address)).to.eq(10);
    });

    it("Should emit event after marking as funded", async () => {
      const { escrow, erc20, receiver, amount, token } = await loadFixture(deploy);

      await erc20.transfer(escrow.address, 10);

      await expect(escrow.markAsFunded()).to.emit(escrow, "Funded").withArgs(
        receiver,
        amount,
        token
      );
    });
  });

  describe("Canceling", function () {
    it("Should cancel if stage FUNDED and date after ExpireAt", async () => {
      const { escrow, lockTime, erc20, owner } = await loadFixture(deployAndFund);

      await time.increase(lockTime + 1)

      await escrow.cancel()
      expect(await escrow.stage()).to.eq(EscrowStages.CANCELED);
      expect(await erc20.balanceOf(escrow.address)).to.eq(0);
      expect(await erc20.balanceOf(owner.address)).to.eq(20);
    });

    it("Should cancel if stage and PENDING date after ExpireAt", async () => {
      const { escrow, lockTime, erc20, owner } = await loadFixture(deploy);

      await time.increase(lockTime + 1)

      await escrow.cancel()
      expect(await escrow.stage()).to.eq(EscrowStages.CANCELED);
      expect(await erc20.balanceOf(escrow.address)).to.eq(0);
      expect(await erc20.balanceOf(owner.address)).to.eq(20);
    });

    it("Should fail to cancel escrow if no expiredYet", async () => {
      const { escrow } = await loadFixture(deploy);

      await expect(escrow.cancel()).to.be.revertedWith(
        "Escrow not expired yet"
      );
    });

    it("Should fail to cancel escrow if in CANCELED state", async () => {
      const { escrow, lockTime, } = await loadFixture(deploy);

      await time.increase(lockTime + 1)

      await escrow.cancel()
      await expect(escrow.cancel()).to.be.revertedWith(
        "Escrow has to be in stage FUNDED or PENDING to be canceled"
      )
    });

    it("Should fail to cancel escrow if in FINALIZED state", async () => {
      const { escrow, lockTime, } = await loadFixture(deploy);

      await time.increase(lockTime + 1)

      await escrow.cancel()
      await expect(escrow.cancel()).to.be.revertedWith(
        "Escrow has to be in stage FUNDED or PENDING to be canceled"
      )
    });
  });

  describe("Finalize", () => {
    it("Should fail to finalize if stage other then FUNDED", async () => {
      const { escrow } = await loadFixture(deploy);

      await expect(escrow.finalize("0x1")).to.be.revertedWith(
        "Can finalize only in FUNDED stage"
      );
    });

    it("Should fail to finalize if wrong password", async () => {
      const { escrow } = await loadFixture(deployAndFund);

      await expect(escrow.finalize("0x1")).to.be.revertedWith(
        "Can not finalize wrong password"
      );
    });

    it("Should finalize", async () => {
      const { escrow, erc20, owner, otherAccount } = await loadFixture(deployAndFund);

      await escrow.finalize("ala_ma_kota");

      expect(await erc20.balanceOf(escrow.address)).to.eq(0);
      expect(await erc20.balanceOf(owner.address)).to.eq(10);
      expect(await erc20.balanceOf(otherAccount.address)).to.eq(30);
    });

    it("Should emit event on finalize", async () => {
      const { escrow, erc20, otherAccount } = await loadFixture(deployAndFund);

      await expect(escrow.finalize("ala_ma_kota")).to.emit(escrow, "Finalized")
        .withArgs(
          otherAccount.address,
          10,
          erc20.address
        )
    });
  });
});