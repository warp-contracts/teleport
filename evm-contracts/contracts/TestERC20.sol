// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    constructor() ERC20("Dollar", "USDT") {}

    function testMint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
