const { ethers, network } = require('hardhat');
const fs = require('fs');

const IPFS = require('ipfs-core');

const FeedbaseJson = require('../artifacts/contracts/Feedbase.sol/Feedbase.json');
const OracleFactoryJson = require('../artifacts/contracts/Oracle.sol/OracleFactory.json');
const OracleJson = require('../artifacts/contracts/Oracle.sol/Oracle.json');

const { create } = require('../../lib/packer');

// Deploy function
async function deploy() {
  const [account] = await ethers.getSigners();
  const deployerAddress = account.address;
  console.log(`Deploying contracts using ${deployerAddress}`);

  //Deploy Feedbase
  const Feedbase = await ethers.getContractFactory('Feedbase');
  const feedbase = await Feedbase.deploy();
  await feedbase.deployed();

  console.log(`Feedbase deployed to : `, feedbase.address);

  //Deploy OracleFactory
  const OracleFactory = await ethers.getContractFactory('OracleFactory');
  const oracleFactory = await OracleFactory.deploy(feedbase.address);
  await oracleFactory.deployed();

  console.log(`OracleFactory deployed to : `, oracleFactory.address);

  // create pack file
  console.log('creating pack file...');
  await create('pack.json', async (mutator: any) => {
    await mutator.addType(OracleJson.contractName, OracleJson);
    await mutator.addType(OracleFactoryJson.contractName, OracleFactoryJson);
    await mutator.addType(FeedbaseJson.contractName, FeedbaseJson);

    await mutator.addObject(
      'oracleFactory',
      oracleFactory.address,
      network.name,
      OracleFactoryJson.contractName,
      OracleFactoryJson
    );
    await mutator.addObject(
      'feedbase',
      feedbase.address,
      network.name,
      FeedbaseJson.contractName,
      FeedbaseJson
    );
  });
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
