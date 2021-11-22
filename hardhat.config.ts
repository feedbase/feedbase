import '@nomiclabs/hardhat-ethers'

import './task/deploy-feedbase.ts'
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  solidity: {
    compilers: [
      {
        version: '0.8.9',
      },
      {
        version: '0.7.6',
      }
    ]
  },
  paths: {
    sources: "sol"
  }
}
