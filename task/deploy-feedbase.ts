import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types'

const debug = require('debug')('feedbase:task')
const dpack = require('@etherpacks/dpack')

task('deploy-feedbase', 'deploy Feedbase')
  .addFlag('stdout', 'print the dpack to stdout')
  .addOptionalParam('outfile', 'save the dpack to this path')
  .setAction(async (args: TaskArguments, hre: any) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    debug(`Deploying contracts using ${deployer} to ${network.name}`)

    const FeedbaseArtifact = require('../artifacts/src/Feedbase.sol/Feedbase.json')
    const MedianizerArtifact = require('../artifacts/src/Medianizer.sol/Medianizer.json')
    const DividerArtifact = require('../artifacts/src/combinators/Divider.sol/Divider.json')
    debug('Loaded artifact')
    const FeedbaseDeployer = ethers.ContractFactory.fromSolidity(FeedbaseArtifact, acct)
    const fb = await FeedbaseDeployer.deploy()
    await fb.deployed()
    debug('Feedbase deployed to : ', fb.address)

    const pb = new dpack.PackBuilder(hre.network.name)
    await pb.packObject({
      objectname: 'feedbase',
      address: fb.address,
      typename: 'Feedbase',
      artifact: FeedbaseArtifact
    }, true) // alsoPackType
    await pb.packType({
      typename: 'Medianizer',
      artifact: MedianizerArtifact
    })
    await pb.packType({
      typename: 'Divider',
      artifact: DividerArtifact
    })

    const pack = await pb.build()
    const str = JSON.stringify(pack, null, 2)
    if (args.stdout) {
      console.log(str)
    }
    if (args.outfile) {
      require('fs').writeFileSync(args.outfile, str)
    }
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
