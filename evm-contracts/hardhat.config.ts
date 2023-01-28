require('dotenv').config();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter"

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  gasReporter: {
    enabled: true,
  },
  networks: {
    mumbai: {
      url: process.env['API'],
      accounts: [`0x${process.env['PRIVATE_KEY']}`]
    }
  }
};

export default config;
