import { run } from 'node:test';

function runTest(file) {
    run({
        files: [
            file
        ]
    })
        .addListener("test:pass", obj => console.log(`PASSED ${obj.name}`))
        .addListener("test:fail", obj => console.log('\x1b[31m%s\x1b[0m', `FAILED ${obj.name}\n${obj?.details?.yaml}`))
        .addListener("test:diagnostic", obj => console.log(obj))
}

runTest('warp-contracts/offer.warp.test.js')
// runTest('warp-contracts/nft.warp.test.js')
