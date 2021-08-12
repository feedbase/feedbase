const debug = require('debug')('feedbase:deploy');

const { ethers, network } = require('hardhat');
const fs = require('fs');

const IPFS = require('ipfs-core');

const FeedbaseJson = require('../artifacts/contracts/Feedbase.sol/Feedbase.json');
const OracleFactoryJson = require('../artifacts/contracts/Oracle.sol/OracleFactory.json');
const OracleJson = require('../artifacts/contracts/Oracle.sol/Oracle.json');
const MockTokenJson = require('../artifacts/contracts/MockToken.sol/MockToken.json');

const { create } = require('../../lib/packer');

let fb: any;
let of: any;
let cash: any;

async function deployMockToken() {
  const TokenDeployer = await ethers.getContractFactory('MockToken');
  cash = await TokenDeployer.deploy('CASH');
  debug(cash.address);

  const tx_mint = await cash.functions['mint(uint256)'](1000);
  await tx_mint.wait();
  const tx_approve = await cash.functions['approve(address)'](fb.address);
  await tx_approve.wait();
}

// Deploy function
async function deploy() {
  const [account] = await ethers.getSigners();
  const deployerAddress = account.address;
  console.log(`Deploying contracts using ${deployerAddress}`);

  //Deploy Feedbase
  const Feedbase = await ethers.getContractFactory('Feedbase');
  fb = await Feedbase.deploy();
  await fb.deployed();

  console.log(`Feedbase deployed to : `, fb.address);

  //Deploy OracleFactory
  const OracleFactory = await ethers.getContractFactory('OracleFactory');
  of = await OracleFactory.deploy(fb.address);
  await of.deployed();

  console.log(`OracleFactory deployed to : `, of.address);

  // create pack file
  console.log('creating pack file...');
  await create('pack.json', async (mutator: any) => {
    await mutator.addType(MockTokenJson.contractName, MockTokenJson);
    await mutator.addType(OracleJson.contractName, OracleJson);
    await mutator.addType(OracleFactoryJson.contractName, OracleFactoryJson);
    await mutator.addType(FeedbaseJson.contractName, FeedbaseJson);

    await mutator.addObject(
      'oracleFactory',
      of.address,
      network.name,
      OracleFactoryJson.contractName,
      OracleFactoryJson
    );
    await mutator.addObject(
      'feedbase',
      fb.address,
      network.name,
      FeedbaseJson.contractName,
      FeedbaseJson
    );
  });

  if (network.name !== 'mainnet') {
    await deployMockToken();
  }
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
