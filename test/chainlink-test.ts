import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, ray, RAY } from 'minihat'
const { constants, BigNumber } = ethers

const debug = require('debug')('feedbase:test')

let fb
let signers
let oracle

const use = (n) => {
  const signer = signers[n]

  if( fb ) fb = fb.connect(signer);
  if( oracle ) oracle = oracle.connect(signer);
}

describe('chainlink', () => {
  const XAU_USD_AGG_ADDR = "0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6"
  const MAX_AGG_TAG = b32("updatedAtMax")

  let tag, seq, sec, ttl, val
  let ali, bob, cat
  let ALI, BOB, CAT
  let adapt, agg
  let config
  let precision
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob, cat] = signers;
    [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const ChainlinkAdapterFactory = await ethers.getContractFactory('ChainlinkAdapter')
    adapt = await ChainlinkAdapterFactory.deploy()

    const MockCLAggFactory = await ethers.getContractFactory('MockChainlinkAggregator')
    agg = await MockCLAggFactory.deploy(fb.address, ALI, b32('updatedAtMax'), 8)
    await agg.deployed();

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
    config = [XAU_USD_AGG_ADDR, BigNumber.from(1)]
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
      want(await adapt.getConfig(tag)).eql([constants.AddressZero, constants.Zero])
      await send(adapt.setConfig, tag, config)
      want(await adapt.getConfig(tag)).eql(config)
  })

  it('look expand', async function () {
      await send(adapt.setConfig, tag, [XAU_USD_AGG_ADDR, BigNumber.from(ttl)])
      let [price, TTL] = await fb.pull(adapt.address, tag)
      // XAU-USD price around 1900 lately
      want(BigNumber.from(price).div(RAY).toNumber()).to.be.closeTo(2000, 500)
  })

  it('read max ttl', async function () {
      await send(fb.push, MAX_AGG_TAG, b32(ethers.constants.Two), ethers.constants.MaxUint256)
      await send(adapt.setConfig, MAX_AGG_TAG, [agg.address, BigNumber.from(ttl), 1])
      let [, resTTL] = await fb.pull(adapt.address, MAX_AGG_TAG)
      // chainlinks updatedAt + adapters TTL overflowed uint256, check it was handled and clamped
      want(resTTL.toHexString()).to.be.equal(ethers.constants.MaxUint256.toHexString())
  })

  // TODO test negative price, like oil or something
})
