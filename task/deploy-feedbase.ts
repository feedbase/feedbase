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

    const contracts = [
      { typename: 'Feedbase',         artifact: require('../artifacts/src/Feedbase.sol/Feedbase.json') },
      { typename: 'Multiplier',       artifact: require('../artifacts/src/combinators/Multiplier.sol/Multiplier.json'),          arg: 'Feedbase' },
      { typename: 'Divider',          artifact: require('../artifacts/src/combinators/Divider.sol/Divider.json'),                arg: 'Feedbase' },
      { typename: 'UniWrapper',       artifact: require('../artifacts/src/adapters/UniWrapper.sol/UniWrapper.json') },
      { typename: 'UniswapV3Adapter', artifact: require('../artifacts/src/adapters/UniswapV3Adapter.sol/UniswapV3Adapter.json'), arg: 'UniWrapper' },
      { typename: 'ChainlinkAdapter', artifact: require('../artifacts/src/adapters/ChainlinkAdapter.sol/ChainlinkAdapter.json') }
    ]
    debug('Loaded artifacts')

    const pb = new dpack.PackBuilder(hre.network.name)
    const deployedAddresses = {}

    for (const { typename, artifact, arg } of contracts) {
      const Deployer = ethers.ContractFactory.fromSolidity(artifact, acct)
      const deployArg = arg ? [deployedAddresses[arg]] : []
      const deployedContract = await Deployer.deploy(...deployArg)
      await deployedContract.deployed()
      deployedAddresses[typename] = deployedContract.address
      debug(`${typename} deployed to: `, deployedContract.address)
      await pb.packObject({
        objectname: typename.toLowerCase(),
        address: deployedContract.address,
        typename: typename,
        artifact: artifact
      }, true)
    }

    // add types of feedbase components which may be deployed later to pack
    await pb.packType({
      typename: 'Medianizer',
      artifact: require('../artifacts/src/combinators/Medianizer.sol/Medianizer.json')
    })
    await pb.packType({
      typename: 'Poker',
      artifact: require('../artifacts/src/Poker.sol/Poker.json')
    })
    await pb.packType({
      typename: 'TWAP',
      artifact: require('../artifacts/src/combinators/TWAP.sol/TWAP.json')
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
