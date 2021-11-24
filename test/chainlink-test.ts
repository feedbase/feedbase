import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let cash
let fb
let signers
let oracle

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  if( cash ) cash = cash.connect(signer);
  if( fb ) fb = fb.connect(signer);
  if( oracle ) oracle = oracle.connect(signer);
}

describe('chainlink', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  const decimals = 18;
  const initialAnswer = 0;
  let tag, seq, sec, ttl, val
  let ali, bob
  let ALI, BOB
  let registry, link, aggregator, adapter;
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob] = signers;
    [ALI, BOB] = [ali.address, bob.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')

    const LinkDeployer = await ethers.getContractFactory('MockToken')
    link = await LinkDeployer.deploy('LINK', 'LINK')

    use(0)


    await send(cash.mint, ALI, 1000)
    await send(cash.approve, fb.address, UINT_MAX)

    const FeedRegistryFactory = await ethers.getContractFactory('MockRegistry');
    registry = await FeedRegistryFactory.deploy();

    await snapshot(hh)
  })

  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from(cash.address.slice(2).padStart(64, '0'), 'hex')
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
  })
})
