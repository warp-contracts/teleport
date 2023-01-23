// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/proxy/Clones.sol";

contract TeleportEscrowFactory {
    address public implementationContract;

    event NewTeleportEscrow(
        address indexed instance,
        bytes32 indexed offerIdHash
    );

    constructor(address _implementation) {
        implementationContract = _implementation;
    }

    function createNewEscrow(
        uint256 lockTime,
        address receiver,
        bytes32 hashedPassword,
        uint256 amount,
        address token,
        bytes32 offerIdHash
    ) external payable returns (address instance) {
        instance = Clones.clone(implementationContract);
        (bool success, ) = instance.call{value: msg.value}(
            abi.encodeWithSignature(
                "initialize(uint256,address,bytes32,uint256,address,address,bytes32)",
                lockTime,
                receiver,
                hashedPassword,
                amount,
                token,
                msg.sender,
                offerIdHash
            )
        );

        if (success == false) {
            revert("Failed to deploy Escrow Instance");
        }

        emit NewTeleportEscrow(instance, offerIdHash);

        return instance;
    }
}
