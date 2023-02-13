import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert, b32, ray, RAY } from 'minihat'
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

describe('chainlink', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  const XAU_USD_AGG_ADDR = "0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6"
  let tag, seq, sec, ttl, val
  let ali, bob, cat
  let ALI, BOB, CAT
  let adapt
  let agg
  let config
  let precision
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob, cat] = signers;
    [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const ChainlinkAdapterFactory = await ethers.getContractFactory('ChainlinkAdapter')
    adapt = await ChainlinkAdapterFactory.deploy(fb.address)

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
    config = [XAU_USD_AGG_ADDR, BigNumber.from(1), BigNumber.from(2)]
    precision = ray(1)
  })

  it('ward', async function () {
      want(await adapt.wards(ALI)).equal(true);
      want(await adapt.wards(BOB)).equal(false);
      want(await adapt.wards(CAT)).equal(false);
      await fail('ErrWard', adapt.connect(bob).ward, CAT, true);
      await fail('ErrWard', adapt.connect(cat).ward, CAT, true);

      await send(adapt.ward, BOB, true);
      await send(adapt.connect(bob).setConfig, b32('hello'), config)

      await send(adapt.ward, BOB, false)
      await fail('ErrWard', adapt.connect(bob).setConfig, b32('hello'), config)
      await fail('ErrWard', adapt.connect(bob).ward, CAT, false)
  })

  it('setConfig', async function () {
      want(await adapt.configs(tag)).eql([constants.AddressZero, constants.Zero, constants.Zero])
      await send(adapt.setConfig, tag, config)
      want(await adapt.configs(tag)).eql(config)
  })

  it('look expand', async function () {
      await send(adapt.setConfig, tag, [XAU_USD_AGG_ADDR, BigNumber.from(ttl), precision])
      await send(adapt.look, tag)
      let [price, TTL] = await fb.pull(adapt.address, tag)
      // XAU-USD price around 1900 lately
      want(BigNumber.from(price).div(RAY).toNumber()).to.be.closeTo(2000, 500)
  })

  it('look truncate', async function () {
      await send(adapt.setConfig, tag, [XAU_USD_AGG_ADDR, BigNumber.from(ttl), 1])
      await send(adapt.look, tag)
      let [price, TTL] = await fb.pull(adapt.address, tag)
      // XAU-USD price around 1900 lately
      want(BigNumber.from(price).toNumber()).to.be.closeTo(2000, 500)
  })

  // TODO test negative price, like oil or something
})


