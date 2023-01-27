// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract TeleportEscrow is Initializable {
    enum Stage {
        PENDING,
        CANCELED,
        FINALIZED
    }
    event Canceled(
        bytes32 indexed offerIdHash,
        address receiver,
        address owner
    );
    event Finalized(
        bytes32 indexed offerIdHash,
        address receiver,
        string password
    );

    uint256 public expireAt;
    address public receiver;
    bytes32 public hashedPassword;
    address public token;
    uint256 public amount;
    address public owner;
    bytes32 public offerIdHash;
    Stage public stage;

    function initialize(
        uint256 lockTime,
        address _receiver,
        bytes32 _hashedPassword,
        uint256 _amount,
        address _token,
        address _owner,
        bytes32 _offerIdHash // it is only needed for case were one seller has to offers, malicouse actor could buy them with one Escrow
    ) external {
        owner = _owner;
        require(lockTime >= 3600, "Lock time has to be >= 3600");
        expireAt = block.timestamp + lockTime;
        receiver = _receiver;
        hashedPassword = _hashedPassword;
        require(_amount > 0, "Amount has to be > 0");
        amount = _amount;
        token = _token;
        offerIdHash = _offerIdHash;
        stage = Stage.PENDING;
    }

    function cancel() external {
        if (block.timestamp <= expireAt) {
            revert("Escrow not expired yet");
        }

        uint256 myBalance = IERC20(token).balanceOf(address(this));
        // funded
        if (myBalance >= amount) {
            IERC20(token).transfer(owner, amount);
        } else if (stage == Stage.CANCELED || stage == Stage.FINALIZED) {
            revert(
                "Escrow has to be in stage FUNDED or PENDING to be canceled"
            );
        }

        stage = Stage.CANCELED;
        emit Canceled(offerIdHash, receiver, owner);
    }

    function finalize(string memory password) external {
        assertFunded();

        if (keccak256(abi.encode(password)) != hashedPassword) {
            revert("Can not finalize wrong password");
        }

        stage = Stage.FINALIZED;
        IERC20(token).transfer(receiver, amount);
        emit Finalized(offerIdHash, receiver, password);
    }

    function assertFunded() private view {
        uint256 myBalance = IERC20(token).balanceOf(address(this));
        require(myBalance >= amount, "Contract has to be funded");
    }
}
