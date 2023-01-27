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

  async function setttl(tag, newttl) {
      let [a, b, , c] = await adapt.configs(tag)
      await send(adapt.setConfig, tag, [a, b, newttl, c])
  }

  async function getpool(tag) {
      let [pool,,] = await adapt.configs(tag)
      return pool
  }

  async function setpool(usr, tag, newpool) {
      let [, a, b, c] = await adapt.configs(tag)
      await send(adapt.connect(usr).setConfig, tag, [newpool, a, b, c])
  }

  async function getrange(tag) {
      let [,range,] = await adapt.configs(tag)
      return range
  }

  async function setrange(tag, newrange) {
      let [a,,b, c] = await adapt.configs(tag)
      await send(adapt.setConfig, tag, [a, newrange, b, c])
  }

  async function setreverse(tag, newreverse) {
      let [a,b,c,] = await adapt.configs(tag)
      await send(adapt.setConfig, tag, [a, b, c, newreverse])
  }

  it('ward', async function () {
      want(await adapt.wards(ALI)).equal(true);
      want(await adapt.wards(BOB)).equal(false);
      want(await adapt.wards(CAT)).equal(false);
      await fail('unwarded sender', adapt.connect(bob).ward, CAT, true);
      await fail('unwarded sender', adapt.connect(cat).ward, CAT, true);

      await send(adapt.ward, BOB, true);
      await send(adapt.connect(bob).setConfig, b32('hello'), [CAT, 2, 3, true])

      await send(adapt.ward, BOB, false)
      await fail('unwarded sender', adapt.connect(bob).setConfig, b32('hello'), [CAT, 2, 3, true])
      await fail('unwarded sender', adapt.connect(bob).ward, CAT, false)
  })

  it('setConfig', async function () {
      want(await adapt.configs(tag)).eql(
          [constants.AddressZero, BigNumber.from(0), BigNumber.from(0), false]
      )
      await send(adapt.setConfig, tag, [CAT, 2, 3, true])
      want(await adapt.configs(tag)).eql(
          [CAT, BigNumber.from(2), BigNumber.from(3), true]
      )
  })

  it('look', async function () {
      await adapt.setConfig(tag, [POOL_ADDR, 500, 100, true])

      let [price, ttl] = await fb.pull(adapt.address, tag)
      want(price).eql(constants.HashZero)
      want(ttl).eql(constants.Zero)

      let look = await send(adapt.look, tag)
      ;[price, ttl] = await fb.pull(adapt.address, tag)

      want(BigNumber.from(price).gt(constants.Zero)).true
      let timestamp = (await ethers.provider.getBlock(look.blockNumber)).timestamp;
      want(ttl).eql(BigNumber.from(timestamp + 100))
      // USDC only has 6 decimals
      let ethusd = BigNumber.from(price).div(BigNumber.from(10).pow(15));
      want(ethusd.gt(1000)).true
      want(ethusd.lt(2000)).true
  })

})


