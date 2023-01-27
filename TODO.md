- [X] specification in js
- [X] example nft on warp
- [X] offer contract on warp
- [X] escrow contract on polygon
- [X] listener and registry on warp 
- [X] gas metering - ile gasu zajmuje deploy escrow
   - [X] czy mozna zoptymalizowac za pomoca beacon albo clones - Około 5.6 razy mniej gazu za deployment z uzyciem clonów.
- [X] Check for bugs - e2e cases

- [ ] Jak znajdować NFT i sprawdzać czy ich interfejs jest {transfer, ownerOf}
    - [X] https://github.com/warp-contracts/warp/issues/332
    - [ ] Trzeba zebrac jakoś wszystkie NFT na warpie, a potem wyszczegolnic te z kompatybilnym dla nas interfejsem (lub kilkoma wymaga dodatkowego okodowania po stronie web)
        - Jak zebrac NFT?
            - coś co w polu data ma duzo contentu
            - praca dla aggragte node to jest dla PST wyglada to teraz tak: https://github.com/warp-contracts/warp-aggregate-node/blob/83a15dbcdee218f4fe2392303559bb83d7d7edf9/src/db/DbUpdates.mjs#L40
- [X] UI
- [X] kto ma otrzymac kase na EVM podanie adresu w offercie
- [ ] staly link miedzy adresem arweave a evm 

- [ ] Wielokrotne podpisywania transakcji :(

- Jaki chcemy miec efekt koncowy?
- Chcemy to wdrozyc zeby bylo uzywalne?
- Chcemy miec demo eby komuś pokazać flow? + np. napisać o tym artykuł
