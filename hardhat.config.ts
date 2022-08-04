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
    sources: "sol"
  }
}
