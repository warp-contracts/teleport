# teleport

## Spec

 * Protocol documentation: https://docs.google.com/document/d/11pocwh5o4-GFjNfQUtmnS2LcsE10ESorcop8iuumUNc/edit#heading=h.wjwhuuom42ou

## Code
* `specification`
    * 
* `warp-contracts`
    * `nft.warp.js` - example nft contract
    * `offer.warp.js` - offer is wrapping nft, to enable "cross" chain transfer
    * to run tests: `npm run test:warp`
* `evm-contracts`
    * `contracts/TestERC20.sol` - sample ERC20 contract, for tests
    * `contracts/TeleportEscrow.sol` - escrow contract to enable "cross" chain transfer together with `offer.warp.js`
    * to run tests: `npm run test:evm`


