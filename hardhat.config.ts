import '@nomiclabs/hardhat-ethers'

import './task/deploy-feedbase.ts'
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  paths: {
    sources: "src"
  },
  networks: {
      hardhat: {
          forking: {
              url: process.env["RPC_URL"],
              blockNumber: 16445606
          }
      }
  }
}
