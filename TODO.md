- [X] specification in js
- [X] example nft on warp
- [X] offer contract on warp
- [X] escrow contract on polygon
- [X] listener and registry on warp 
- [X] gas metering - ile gasu zajmuje deploy escrow
   - [X] czy mozna zoptymalizowac za pomoca beacon albo clones - Około 5.6 razy mniej gazu za deployment z uzyciem clonów.

- [ ] Jak znajdować NFT i sprawdzać czy ich interfejs jest {transfer, ownerOf}
    - [X] Zbadać ich NFT: pianity NFT verto, koii, alex
        * Pianity
            - To co znalazłem obserwujac ich strone np. taka licytacja: https://pianity.com/deep-state/altered-states. Contract: https://sonar-gzjtck03x-redstone-finance.vercel.app/?#/app/contract/XIutiOKujGI21_ywULlBeyy-L9d8goHxt0ZyUayGaDg#code
            - Ale w githubie implementuja erc1155 (inny interfejs niz ERC721) 
            - `{balanceOf(address _owner, uint256 _id), safeTransferFrom(address _from, address _to, uint256 _id, uint256 _value)}`
        * Verto
            - Oni tez implementuja coś swojego: https://github.com/useverto/contracts/blob/main/src/nft/faces.ts
            - `{balance(target: string), transfer(target: string, qty: number)}`
        * koii
            - Oni chyba nie zyja juz
            - wszystko public archive https://github.com/orgs/koii-network/repositories?type=all
        * alex
            - Nie moge znalezc repo
    - [ ] Trzeba zebrac jakoś wszystkie NFT na warpie, a potem wyszczegolnic te z kompatybilnym dla nas interfejsem (lub kilkoma wymaga dodatkowego okodowania po stronie web)
        - Jak zebrac NFT?
            - coś co w polu data ma duzo contentu
            - praca dla aggragte node to jest dla PST wyglada to teraz tak: https://github.com/warp-contracts/warp-aggregate-node/blob/83a15dbcdee218f4fe2392303559bb83d7d7edf9/src/db/DbUpdates.mjs#L40

- [ ] Check for bugs - e2e cases

- [ ] UI
- [ ] staly link miedzy adresem arweave a evm 
- [ ] kto ma otrzymac kase na EVM podanie adresu w offercie

- [ ]  https://github.com/warp-contracts/warp/issues/323 -   INIT_STATE = 'Init-State',