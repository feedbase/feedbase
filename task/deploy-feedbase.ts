import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types'

const debug = require('debug')('feedbase:task')

task('deploy-feedbase', 'deploy Feedbase and BasicReceiverFactory')
  .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    console.log(`Deploying contracts using ${deployer} to ${network.name}`)

    const FeedbaseDeployer = await hre.ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseDeployer.deploy()
    await fb.deployed()
    console.log('Feedbase deployed to : ', fb.address)
    const FeedbaseArtifact = await hre.artifacts.readArtifact('Feedbase')

    const BasicReceiverFactoryDeployer = await hre.ethers.getContractFactory('BasicReceiverFactory')
    const brf = await BasicReceiverFactoryDeployer.deploy(fb.address)
    await brf.deployed()
    console.log('BasicReceiverFactory deployed to : ', brf.address)

    const BasicReceiverArtifact = await hre.artifacts.readArtifact('BasicReceiver')
    const BasicReceiverFactoryArtifact = await hre.artifacts.readArtifact('BasicReceiverFactory')

  })
