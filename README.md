# teleport

## Spec

 * Protocol documentation: https://docs.google.com/document/d/11pocwh5o4-GFjNfQUtmnS2LcsE10ESorcop8iuumUNc/edit#heading=h.wjwhuuom42ou

## Code
* `specification`
    * Code in pure js and according tests to test protocol idea
    * to run tests: `npm run test:spec`
* `warp-contracts`
    * `nft.warp.js` - example nft contract
    * `offer.warp.js` - offer is wrapping nft, to enable "cross" chain transfer
    * to run tests: `npm run test:warp`
* `evm-contracts`
    * `contracts/TestERC20.sol` - sample ERC20 contract, for tests
    * `contracts/TeleportEscrow.sol` - escrow contract to enable "cross" chain transfer together with `offer.warp.js`
    * to run tests: `npm run test:evm`
* `clients`
    * encapsulate code in two classes `Buyer` and `Seller` this code can be used in browser and in node
* `demo-node`
    * demo in node.js
    * It trades NFT in exchange of some ERC20 token
    * Run instructions:
     1. `cd evm-contracts && npx hardhat --node`
     2. open new terminal
     3. `cd evm-contracts && npx hardhat run scripts/deploy.ts && cd ..`
     4. Replace `TEST_PAYMENT_TOKEN` in `demo-node/main.ts` with output address from previous step
     5. `npm run demo:node`

    * `sample output`:
    ```
    Seller: Created offer dtKl1TKN1Iw6BFwsWX8BXuiH3pQpJYjPloNpJkk4Wes for NFT: Su12V4DmFWXSdFFiizY44Y0RuctpXsjVKganQV0HA38:1 for price 10 paid in token 0x0B306BF915C4d645ff596e518fAf3F9669b97016
    Buyer: Accepted offer dtKl1TKN1Iw6BFwsWX8BXuiH3pQpJYjPloNpJkk4Wes and secured it by escrow 0x87F850cbC2cFfac086F20d0d7307E12d06fA2127
    Seller: Accepted 0x87F850cbC2cFfac086F20d0d7307E12d06fA2127
    Buyer: Finalized offer and revealed password: password
    Seller: Withdraw money from escrow using revealed password
    ```

* Gas metering EVM:
```
·---------------------------------------------|----------------------------|-------------|-----------------------------·
|             Solc version: 0.8.9             ·  Optimizer enabled: false  ·  Runs: 200  ·  Block limit: 30000000 gas  │
··············································|····························|·············|······························
|  Methods                                                                                                             │
··························|···················|··············|·············|·············|···············|··············
|  Contract               ·  Method           ·  Min         ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
··························|···················|··············|·············|·············|···············|··············
|  TeleportEscrow         ·  cancel           ·       63491  ·      73031  ·      65876  ·            4  ·          -  │
··························|···················|··············|·············|·············|···············|··············
|  TeleportEscrow         ·  finalize         ·           -  ·          -  ·      50828  ·            3  ·          -  │
··························|···················|··············|·············|·············|···············|··············
|  TeleportEscrowFactory  ·  createNewEscrow  ·           -  ·          -  ·     233619  ·            6  ·          -  │
··························|···················|··············|·············|·············|···············|··············
|  TestERC20              ·  testMint         ·       51863  ·      68963  ·      60413  ·            6  ·          -  │
··························|···················|··············|·············|·············|···············|··············
|  TestERC20              ·  transfer         ·           -  ·          -  ·      52123  ·            2  ·          -  │
··························|···················|··············|·············|·············|···············|··············
|  Deployments                                ·                                          ·  % of limit   ·             │
··············································|··············|·············|·············|···············|··············
|  TeleportEscrow                             ·           -  ·          -  ·    1118111  ·        3.7 %  ·          -  │
··············································|··············|·············|·············|···············|··············
|  TeleportEscrowFactory                      ·           -  ·          -  ·     469854  ·        1.6 %  ·          -  │
··············································|··············|·············|·············|···············|··············
|  TestERC20                                  ·           -  ·          -  ·    1223058  ·        4.1 %  ·          -  │
·---------------------------------------------|--------------|-------------|-------------|---------------|-------------·
```
So whole cost for buyer: `233619 + 52123 = 285742` and for seller: `50806`
Gas price: `40` (eth mainnet 01.2023)
ETH cost: `1564`
So for buyer `261016 * 40 * 0.000000001 * 1564= 17.87` USD :)