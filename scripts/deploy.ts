const debug = require('debug')('feedbase:deploy');

const { ethers, network } = require('hardhat');
const fs = require('fs');

const IPFS = require('ipfs-core');

const FeedbaseJson = require('../artifacts/contracts/Feedbase.sol/Feedbase.json');
const OracleFactoryJson = require('../artifacts/contracts/Oracle.sol/OracleFactory.json');
const OracleJson = require('../artifacts/contracts/Oracle.sol/Oracle.json');
const MockTokenJson = require('../artifacts/contracts/MockToken.sol/MockToken.json');

const { mutate } = require('../../lib/packer');

// Deploy function
async function deploy() {
  const [account] = await ethers.getSigners();
  const deployerAddress = account.address;
  console.log(`Deploying contracts using ${deployerAddress}`);

  //Deploy Feedbase
  const Feedbase = await ethers.getContractFactory('Feedbase');
  const fb = await Feedbase.deploy();
  await fb.deployed();
  console.log(`Feedbase deployed to : `, fb.address);

  //Deploy OracleFactory
  const OracleFactory = await ethers.getContractFactory('OracleFactory');
  const of = await OracleFactory.deploy(fb.address);
  await of.deployed();
  console.log(`OracleFactory deployed to : `, of.address);

  //Deploy MockToken
  const MockToken = await ethers.getContractFactory('MockToken');
  const mt = await MockToken.deploy('CASH');
  await mt.deployed();
  console.log('MockToken Deployed to:', mt.address);
  
  // create pack file
  console.log('creating pack file...');
  await mutate('pack.json', 'pack.json', async (mutator: any) => {
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
    await mutator.addObject(
      'mockToken',
      mt.address,
      network.name,
      MockTokenJson.contractName,
      MockTokenJson
    )
  });
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
