// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract TeleportEscrow {
    enum Stage {
        PENDING,
        FUNDED,
        CANCELED,
        FINALIZED
    }
    event Funded(address receiver, uint256 amount, address token);
    event Canceled(address receiver, uint256 amount, address token);
    event Finalized(address receiver, uint256 amount, address token);

    uint256 public expireAt;
    address public receiver;
    bytes32 public hashedPassword;
    address public token;
    uint256 public amount;
    address public owner;
    Stage public stage;

    constructor(
        uint256 lockTime,
        address _receiver,
        bytes32 _hashedPassword,
        uint256 _amount,
        address _token
    ) {
        owner = msg.sender;
        require(lockTime >= 3600, "Lock time has to be >= 3600");
        expireAt = block.timestamp + lockTime;
        receiver = _receiver;
        hashedPassword = _hashedPassword;
        require(_amount > 0, "Amount has to be > 0");
        amount = _amount;
        token = _token;
        stage = Stage.PENDING;
    }

    function markAsFunded() external {
        uint256 myBalance = IERC20(token).balanceOf(address(this));
        require(
            myBalance >= amount,
            "To mark as funded contract has to posses tokens"
        );

        stage = Stage.FUNDED;
        emit Funded(receiver, amount, token);
    }

    function cancel() external {
        if (block.timestamp <= expireAt) {
            revert("Escrow not expired yet");
        }

        if (stage == Stage.FUNDED) {
            IERC20(token).transfer(owner, amount);
        } else if (stage == Stage.CANCELED || stage == Stage.FINALIZED) {
            revert(
                "Escrow has to be in stage FUNDED or PENDING to be canceled"
            );
        }

        stage = Stage.CANCELED;
        emit Canceled(receiver, amount, token);
    }

    function finalize(string memory password) external {
        if (stage != Stage.FUNDED) {
            revert("Can finalize only in FUNDED stage");
        }

        if (keccak256(abi.encode(password)) != hashedPassword) {
            revert("Can not finalize wrong password");
        }

        IERC20(token).transfer(receiver, amount);
        emit Finalized(receiver, amount, token);
    }
}
