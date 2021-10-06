"use strict";
exports.__esModule = true;
require("@nomiclabs/hardhat-ethers");
require("./tasks/deploy1.ts");
var _a = process.env, PRIVKEY = _a.PRIVKEY, INFURA_PROJECT_ID = _a.INFURA_PROJECT_ID;
var privKey = PRIVKEY !== null && PRIVKEY !== void 0 ? PRIVKEY : Buffer.alloc(32).toString('hex');
console.log(privKey);
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
exports["default"] = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {},
        mainnet: {
            url: "https://mainnet.infura.io/v3/" + INFURA_PROJECT_ID,
            chainId: 1,
            accounts: ["0x" + privKey]
        },
        kovan: {
            url: "https://kovan.infura.io/v3/" + INFURA_PROJECT_ID,
            chainId: 42,
            accounts: ["0x" + privKey]
        },
        ropsten: {
            url: "https://ropsten.infura.io/v3/" + INFURA_PROJECT_ID,
            chainId: 3,
            accounts: ["0x" + privKey]
        },
        manaflow: {
            url: 'http://localhost:8545',
            chainId: 1,
            accounts: ["0x" + privKey]
        }
    },
    solidity: '0.8.6'
};
