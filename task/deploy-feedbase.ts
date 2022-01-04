const debug = require('debug')('feedbase:task')

import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types'

import { PackBuilder } from 'dpack'

task('deploy-feedbase', 'deploy Feedbase')
  .setAction(async (args: TaskArguments, hre: any) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    debug(`Deploying contracts using ${deployer} to ${network.name}`)

    const FeedbaseArtifact = require('../artifacts/sol/Feedbase.sol/Feedbase.json')
    debug(`Loaded artifact`)
    const FeedbaseDeployer = ethers.ContractFactory.fromSolidity(FeedbaseArtifact, acct)
    const fb = await FeedbaseDeployer.deploy()
    await fb.deployed()
    debug('Feedbase deployed to : ', fb.address)

    const pb = new PackBuilder(network.name);
    await pb.packObject({
      objectname: 'feedbase',
      address: fb.address,
      typename: 'Feedbase',
      artifact: FeedbaseArtifact
    });
    await pb.packType({
      typename: 'Feedbase',
      artifact: FeedbaseArtifact
    });
    
    const pack = await pb.build();
    console.log(JSON.stringify(pack, null, 2))

    return pack
  })

/*
task('deploy-receiver-factory', 'deploy BasicReceiverFactory')
  .addParam('feedbaseAddress', 'feedbase address')
  .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
    const BasicReceiverFactoryDeployer = await hre.ethers.getContractFactory('BasicReceiverFactory')
    const brf = await BasicReceiverFactoryDeployer.deploy(args.feedbaseAddress)
    await brf.deployed()
    console.log('BasicReceiverFactory deployed to : ', brf.address)

    const BasicReceiverArtifact = await hre.artifacts.readArtifact('BasicReceiver')
    const BasicReceiverFactoryArtifact = await hre.artifacts.readArtifact('BasicReceiverFactory')
  })
*/
