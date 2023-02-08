- [x] specification in js
- [x] example nft on warp
- [x] offer contract on warp
- [x] escrow contract on polygon
- [x] listener and registry on warp
- [x] gas metering - ile gasu zajmuje deploy escrow
  - [x] czy mozna zoptymalizowac za pomoca beacon albo clones - Około 5.6 razy
        mniej gazu za deployment z uzyciem clonów.
- [x] Check for bugs - e2e cases

- [ ] Jak znajdować NFT i sprawdzać czy ich interfejs jest {transfer, ownerOf}
  - [x] https://github.com/warp-contracts/warp/issues/332
  - [ ] Trzeba zebrac jakoś wszystkie NFT na warpie, a potem wyszczegolnic te z
        kompatybilnym dla nas interfejsem (lub kilkoma wymaga dodatkowego
        okodowania po stronie web)
    - Jak zebrac NFT?
      - coś co w polu data ma duzo contentu
      - praca dla aggragte node to jest dla PST wyglada to teraz tak:
        https://github.com/warp-contracts/warp-aggregate-node/blob/83a15dbcdee218f4fe2392303559bb83d7d7edf9/src/db/DbUpdates.mjs#L40
- [x] UI
- [x] kto ma otrzymac kase na EVM podanie adresu w offercie
- [ ] Indexowanie escrow po stronie backendu
- [ ] Automatyzacja procesow (zrobienie backendu który będize kręcił niektóre
      operacje)
- [ ] staly link miedzy adresem arweave a evm
- [ ] Wielokrotne podpisywania transakcji :(
- [ ] uzywac ETH zamiast USDT

- [ ] alexa umiemiy indeksowac po tagach
