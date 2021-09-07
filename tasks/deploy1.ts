const debug = require('debug')('feedbase:task')

const dpack = require('dpack')

const { task } = require('hardhat/config');

task("deploy1", "deploy feedbase-core-pack and feedbase-full-pack v1", async (args, hre) => {
  const { ethers, network } = hre;

  const [acct] = await hre.ethers.getSigners();
  const deployer = acct.address;

  console.log(`Deploying contracts using ${deployer} to ${network.name}`)

  const corePath = 'dist/feedbase-core-pack.json'
  const fullPath = 'dist/feedbase-full-pack.json'

  await dpack.initPackFile(corePath)

  let fb

  await dpack.mutatePackFile(corePath, corePath, async (mutator: any) => {
    const FeedbaseDeployer = await hre.ethers.getContractFactory('Feedbase')
    fb = await FeedbaseDeployer.deploy()
    await fb.deployed()
    console.log('Feedbase deployed to : ', fb.address)
    const FeedbaseArtifact = await hre.artifacts.readArtifact("Feedbase")
    await mutator.addType(FeedbaseArtifact)
    await mutator.addObject(
      'feedbase',
      fb.address,
      network.name,
      FeedbaseArtifact
    )
  })

  await dpack.mutatePackFile(corePath, fullPath, async (mutator: any) => {
    const BasicReceiverFactoryDeployer = await hre.ethers.getContractFactory('BasicReceiverFactory')
    const of = await BasicReceiverFactoryDeployer.deploy(fb.address)
    await of.deployed()
    console.log('BasicReceiverFactory deployed to : ', of.address)

    const MockTokenDeployer = await ethers.getContractFactory('MockToken')
    const mt = await MockTokenDeployer.deploy('CASH')
    await mt.deployed()
    console.log('MockToken Deployed to:', mt.address)

    const MockTokenArtifact = await hre.artifacts.readArtifact("contracts/erc20/MockToken.sol:MockToken");
    const BasicReceiverArtifact = await hre.artifacts.readArtifact("BasicReceiver");
    const BasicReceiverFactoryArtifact = await hre.artifacts.readArtifact("BasicReceiverFactory");

    await mutator.addType(MockTokenArtifact)
    await mutator.addType(BasicReceiverArtifact)
    await mutator.addType(BasicReceiverFactoryArtifact)

    await mutator.addObject(
      'receiverFactory',
      of.address,
      network.name,
      BasicReceiverFactoryArtifact
    )
    await mutator.addObject(
      'mockToken',
      mt.address,
      network.name,
      MockTokenArtifact
    )
  })

});

export {}
