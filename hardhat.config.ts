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
      },
      {
        version: '0.6.6',
      },
      {
        version: '0.4.24',
      }
    ]
  },
  paths: {
    sources: "sol"
  }
}
