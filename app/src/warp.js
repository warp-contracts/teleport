import { EthersExtension } from "warp-contracts-plugin-ethers";
import { EvmSignatureVerificationWebPlugin } from 'warp-contracts-plugin-signature';
import { WarpFactory, LoggerFactory } from "warp-contracts/web";

LoggerFactory.INST.logLevel('error');
export default WarpFactory
    .forMainnet()
    .use(new EthersExtension())
    .use(new EvmSignatureVerificationWebPlugin());