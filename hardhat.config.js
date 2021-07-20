/**
 * @type import('hardhat/config').HardhatUserConfig
 */

require("@nomiclabs/hardhat-ethers")

const { DEPLOYER_PRIVATE_KEY, INFURA_PROJECT_ID } = process.env;

const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 1,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 42,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 3,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
    },
    manaflow: {
      url: "http://localhost:8545",
      chainId: 1,
      accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],

    }
  },
  solidity: '0.8.3',
};

// export default config;
module.exports = config;
