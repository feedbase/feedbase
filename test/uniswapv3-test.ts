import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert, b32 } from 'minihat'
const { constants, BigNumber, utils } = ethers

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let fb
let signers
let oracle

const use = (n) => {
  const signer = signers[n]

  if( fb ) fb = fb.connect(signer);
  if( oracle ) oracle = oracle.connect(signer);
}

describe('uniswapv3', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  const POOL_ADDR = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"
  let tag, seq, sec, ttl, val
  let ali, bob, cat
  let ALI, BOB, CAT
  let adapt
  let pool
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob, cat] = signers;
    [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const UniswapV3AdapterFactory = await ethers.getContractFactory('UniswapV3Adapter')
    adapt = await UniswapV3AdapterFactory.deploy(fb.address)

    use(0)

    await snapshot(hh)
  })
  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from('USDCASH'.padStart(32, '\0'))
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
  })

  async function getttl(tag) {
      let [,,ttl] = await adapt.configs(tag)
      return ttl
  }

  async function getpool(tag) {
      let [pool,,] = await adapt.configs(tag)
      return pool
  }

  async function getrange(tag) {
      let [,range,] = await adapt.configs(tag)
      return range
  }


  it('ward', async function () {
      want(await adapt.wards(ALI)).equal(true);
      want(await adapt.wards(BOB)).equal(false);
      want(await adapt.wards(CAT)).equal(false);
      await fail('unwarded sender', adapt.connect(bob).ward, CAT, true);
      await fail('unwarded sender', adapt.connect(cat).ward, CAT, true);

      await send(adapt.ward, BOB, true);
      await send(adapt.connect(bob).setPool, b32('hello'), CAT)
      await send(adapt.connect(bob).setTTL, b32('hello'), ttl);
      await send(adapt.ward, BOB, false)
      await fail('unwarded sender', adapt.connect(bob).setPool, b32('hello'), CAT)
      await fail('unwarded sender', adapt.connect(bob).setTTL, b32('hello'), ttl);
      await fail('unwarded sender', adapt.connect(bob).ward, CAT, false)
 
  })

  it('setPool', async function () {
      want(await getpool(tag)).equal(constants.AddressZero)
      await send(adapt.setPool, tag, CAT)
      want(await getpool(tag)).equal(CAT)
  })

  it('setTTL', async function () {
      want(await getttl(tag)).eql(constants.Zero)
      await send(adapt.setTTL, tag, 1)
      want(await getttl(tag)).eql(constants.One)
  })

  it('look', async function () {
      await send(adapt.setPool, tag, POOL_ADDR)
      await send(adapt.setTTL, tag, 100)
      await send(adapt.setRange, tag, 500)

      let [price, ttl] = await fb.pull(adapt.address, tag)
      want(price).eql(constants.HashZero)
      want(ttl).eql(constants.Zero)

      let look = await send(adapt.look, tag)
      ;[price, ttl] = await fb.pull(adapt.address, tag)

      want(BigNumber.from(price).gt(constants.Zero)).true
      let timestamp = (await ethers.provider.getBlock(look.blockNumber)).timestamp;
      want(ttl).eql(BigNumber.from(timestamp + 100))
  })

})


