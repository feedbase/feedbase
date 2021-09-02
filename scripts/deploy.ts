const debug = require('debug')('feedbase:deploy')

const { ethers, network } = require('hardhat')

const dpack = require('../../lib/dpack')

const FeedbaseJson = require('../artifacts/contracts/Feedbase.sol/Feedbase.json')
const BasicReceiverFactoryJson = require('../artifacts/contracts/Receiver.sol/BasicReceiverFactory.json')
const BasicReceiverJson = require('../artifacts/contracts/Receiver.sol/BasicReceiver.json')
const MockTokenJson = require('../artifacts/contracts/erc20/MockToken.sol/MockToken.json')

async function deploy () {
  const [account] = await ethers.getSigners()
  const deployerAddress = account.address
  console.log(`Deploying contracts using ${deployerAddress} to ${network.name}`)

  const corePath = 'dist/feedbase-core-pack.json'
  const fullPath = 'dist/feedbase-full-pack.json'

  await dpack.initPackFile(corePath)

  let fb

  await dpack.mutatePackFile(corePath, corePath, async (mutator: any) => {
    const Feedbase = await ethers.getContractFactory('Feedbase')
    fb = await Feedbase.deploy()
    await fb.deployed()
    console.log('Feedbase deployed to : ', fb.address)
    await mutator.addType(FeedbaseJson)
    await mutator.addObject(
      'feedbase',
      fb.address,
      network.name,
      FeedbaseJson
    )
  })

  await dpack.mutatePackFile(corePath, fullPath, async (mutator: any) => {
    const BasicReceiverFactory = await ethers.getContractFactory('BasicReceiverFactory')
    const of = await BasicReceiverFactory.deploy(fb.address)
    await of.deployed()
    console.log('BasicReceiverFactory deployed to : ', of.address)

    const MockToken = await ethers.getContractFactory('MockToken')
    const mt = await MockToken.deploy('CASH')
    await mt.deployed()
    console.log('MockToken Deployed to:', mt.address)

    await mutator.addType(MockTokenJson)
    await mutator.addType(BasicReceiverJson)
    await mutator.addType(BasicReceiverFactoryJson)

    await mutator.addObject(
      'receiverFactory',
      of.address,
      network.name,
      BasicReceiverFactoryJson
    )
    await mutator.addObject(
      'mockToken',
      mt.address,
      network.name,
      MockTokenJson
    )
  })
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
