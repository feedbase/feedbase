require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-ethers")

const { DEPLOYER_PRIVATE_KEY, INFURA_PROJECT_ID } = process.env;

const privKey = DEPLOYER_PRIVATE_KEY ?? Buffer.alloc(32).toString("hex");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 1,
      accounts: [`0x${privKey}`],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 42,
      accounts: [`0x${privKey}`],
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 3,
      accounts: [`0x${privKey}`],
    },
    manaflow: {
      url: "http://localhost:8545",
      chainId: 1,
      accounts: [`0x${privKey}`],

    }
  },
  solidity: '0.8.6',
};

module.exports = config;
