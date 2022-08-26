import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types'

const debug = require('debug')('feedbase:task')
const dpack = require('@etherpacks/dpack')

task('deploy-feedbase', 'deploy Feedbase')
    .addFlag('stdout', 'print the dpack to stdout')
    .addFlag('pack', 'whether or not to save the dpack')
    .addOptionalParam('outfile', 'save the dpack to this path')
    .setAction(async (args: TaskArguments, hre: any) => {
        const { ethers, network } = hre

        const [acct] = await hre.ethers.getSigners()
        const deployer = acct.address

        console.log(`Deploying contracts using ${deployer} to ${network.name}`)

        const FeedbaseArtifact = require('../artifacts/src/Feedbase.sol/Feedbase.json')
        const FeedbaseDeployer = ethers.ContractFactory.fromSolidity(FeedbaseArtifact, acct)
        const fb = await FeedbaseDeployer.deploy()
        await fb.deployed()
        console.log('Feedbase deployed to : ', fb.address)

        if (args.pack) {
            const pb = new dpack.PackBuilder(network.name)
            await pb.packObject({
                objectname: 'feedbase',
                address: fb.address,
                typename: 'Feedbase',
                artifact: FeedbaseArtifact
            }, true) // alsoPackType

            const pack = await pb.build()
            const str = JSON.stringify(pack, null, 2)
            if (args.stdout) {
                console.log(str)
            }
            if (args.outfile) {
                require('fs').writeFileSync(args.outfile, str)
            }
            return pack
        }
    })

task('deploy-receiver-factory', 'deploy BasicReceiverFactory')
    .addParam('feedbaseAddress', 'feedbase address')
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const BasicReceiverFactoryDeployer = await hre.ethers.getContractFactory('BasicReceiverFactory')
        const brf = await BasicReceiverFactoryDeployer.deploy(args.feedbaseAddress)
        await brf.deployed()
        console.log('BasicReceiverFactory deployed to : ', brf.address)
    })

task('deploy-medianizer', 'deploy Medianizer')
    .addParam('feedbaseAddress', 'feedbase address')
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const MedianizerFactory = await hre.ethers.getContractFactory('Medianizer')
        const medianizer = await MedianizerFactory.deploy(args.feedbaseAddress)
        await medianizer.deployed()

        console.log('Medianizer deployed to : ', medianizer.address)
    })
