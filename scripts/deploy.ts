const debug = require('debug')('feedbase:deploy');

const { ethers, network } = require('hardhat');

const FeedbaseJson = require('../artifacts/contracts/Feedbase.sol/Feedbase.json');
const BasicReceiverFactoryJson = require('../artifacts/contracts/Receiver.sol/BasicReceiverFactory.json');
const BasicReceiverJson = require('../artifacts/contracts/Receiver.sol/BasicReceiver.json');
const MockTokenJson = require('../artifacts/contracts/MockToken.sol/MockToken.json');

const { initPackFile, mutatePackFile } = require('../../lib/dpack');

async function deploy() {
  console.log('creating pack file...');
  await initPackFile('/tmp/feedbase.json');
  await mutatePackFile('/tmp/feedbase.json', 'dist/feedbase-pack.json', async (mutator: any) => {
    const [account] = await ethers.getSigners();
    const deployerAddress = account.address;
    console.log(`Deploying contracts using ${deployerAddress} to ${network.name}`);

    //Deploy Feedbase
    const Feedbase = await ethers.getContractFactory('Feedbase');
    const fb = await Feedbase.deploy();
    await fb.deployed();
    console.log(`Feedbase deployed to : `, fb.address);

    //Deploy BasicReceiverFactory
    const BasicReceiverFactory = await ethers.getContractFactory('BasicReceiverFactory');
    const of = await BasicReceiverFactory.deploy(fb.address);
    await of.deployed();
    console.log(`BasicReceiverFactory deployed to : `, of.address);

    //Deploy MockToken
    const MockToken = await ethers.getContractFactory('MockToken');
    const mt = await MockToken.deploy('CASH');
    await mt.deployed();
    console.log('MockToken Deployed to:', mt.address);
  
    await mutator.addType(MockTokenJson.contractName, MockTokenJson);
    await mutator.addType(BasicReceiverJson.contractName, BasicReceiverJson);
    await mutator.addType(BasicReceiverFactoryJson.contractName, BasicReceiverFactoryJson);
    await mutator.addType(FeedbaseJson.contractName, FeedbaseJson);

    await mutator.addObject(
      'receiverFactory',
      of.address,
      network.name,
      BasicReceiverFactoryJson.contractName,
      BasicReceiverFactoryJson
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
