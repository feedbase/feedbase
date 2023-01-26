import '@nomiclabs/hardhat-ethers'

import './task/deploy-feedbase.ts'
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: {
    version: "0.8.15",
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
              url: "https://mainnet.infura.io/v3/484ea25767d643f392897c6dfef786c1",
              blockNumber: 16445606
          }
      }
  }
}
