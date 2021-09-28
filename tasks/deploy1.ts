const debug = require('debug')('feedbase:task')

const dpack = require('dpack')

const { task } = require('hardhat/config')

task('deploy-feedbase', 'deploy Feedbase and BasicReceiverFactory')
.addParam('dpack', "output path for dpack")
.setAction(async (args, hre) => {
  const { ethers, network } = hre

  const [acct] = await hre.ethers.getSigners()
  const deployer = acct.address

  console.log(`Deploying contracts using ${deployer} to ${network.name}`)

  await dpack.initPackFile(args.dpack)

  let fb

  await dpack.mutatePackFile(args.dpack, args.dpack, async (mutator: any) => {
    const FeedbaseDeployer = await hre.ethers.getContractFactory('Feedbase')
    fb = await FeedbaseDeployer.deploy()
    await fb.deployed()
    console.log('Feedbase deployed to : ', fb.address)
    const FeedbaseArtifact = await hre.artifacts.readArtifact('Feedbase')

    await mutator.addType(FeedbaseArtifact)
    await mutator.addObject(
      'feedbase',
      fb.address,
      network.name,
      FeedbaseArtifact
    )

    const BasicReceiverFactoryDeployer = await hre.ethers.getContractFactory('BasicReceiverFactory')
    const brf = await BasicReceiverFactoryDeployer.deploy(fb.address)
    await brf.deployed()
    console.log('BasicReceiverFactory deployed to : ', brf.address)

    const BasicReceiverArtifact = await hre.artifacts.readArtifact('BasicReceiver')
    const BasicReceiverFactoryArtifact = await hre.artifacts.readArtifact('BasicReceiverFactory')

    await mutator.addType(BasicReceiverArtifact)
    await mutator.addType(BasicReceiverFactoryArtifact)

    await mutator.addObject(
      'receiverFactory',
      brf.address,
      network.name,
      BasicReceiverFactoryArtifact
    )
  })

})

export {}
