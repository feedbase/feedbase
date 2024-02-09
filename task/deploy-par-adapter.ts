import { task } from 'hardhat/config'
import { TaskArguments } from 'hardhat/types'

const debug = require('debug')('feedbase:task')
const dpack = require('@etherpacks/dpack')

task('deploy-par-adapter', 'deploy ParAdapter')
  .addOptionalParam('rbpackcid', 'ricobank pack ipfs cid')
  .addOptionalParam('vatAddr', 'vat address (bank diamond)')
  .addFlag('stdout', 'print the dpack to stdout')
  .addOptionalParam('outfile', 'save the dpack to this path')
  .setAction(async (args: TaskArguments, hre: any) => {
    const { ethers, network } = hre

    const [acct] = await hre.ethers.getSigners()
    const deployer = acct.address

    let vatAddress
    if (args.rbpackcid) {
        const rbpack = await dpack.getIpfsJson(args.rbpackcid)
        const dapp = await dpack.load(rbpack, ethers, acct)
        vatAddress = dapp.bank.address
    } else if (args.vatAddr) {
        vatAddress = args.vatAddr
    } else {
        throw new Error('must pass in vat/bank address to read par from as rbpackcid or vatAddr')
    }

    const artifact = require('../artifacts/src/adapters/ParAdapter.sol/ParAdapter.json')
    const pb = new dpack.PackBuilder(hre.network.name)
    const Deployer = ethers.ContractFactory.fromSolidity(artifact, acct)

    debug(`Deploying ParAdapter using ${deployer} to ${network.name}`)

    const deployedContract = await Deployer.deploy(vatAddress)
    await deployedContract.deployed()
    debug(`ParAdapter deployed to: `, deployedContract.address)
    await pb.packObject({
        objectname: 'paradapter',
        address: deployedContract.address,
        typename: 'ParAdapter',
        artifact: artifact
    }, true)

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
