import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32 } from 'minihat'
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

describe('uniswapv3', () => {
  const ETH_USD_POOL_ADDR = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"
  const BTC_USD_POOL_ADDR = "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35"
  let tag, seq, sec, ttl, val
  let ali, bob, cat
  let ALI, BOB, CAT
  let adapt, wrap
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob, cat] = signers;
    [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const UniWrapperFactory = await ethers.getContractFactory('UniWrapper')
    wrap = await UniWrapperFactory.deploy()
    const UniswapV3AdapterFactory = await ethers.getContractFactory('UniswapV3Adapter')
    adapt = await UniswapV3AdapterFactory.deploy(fb.address, wrap.address)

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

  it('ward', async function () {
      want(await adapt.wards(ALI)).equal(true);
      want(await adapt.wards(BOB)).equal(false);
      want(await adapt.wards(CAT)).equal(false);
      await fail('ErrWard', adapt.connect(bob).ward, CAT, true);
      await fail('ErrWard', adapt.connect(cat).ward, CAT, true);

      await send(adapt.ward, BOB, true);
      await send(adapt.connect(bob).setConfig, b32('hello'), [CAT, 2, 3, true])

      await send(adapt.ward, BOB, false)
      await fail('ErrWard', adapt.connect(bob).setConfig, b32('hello'), [CAT, 2, 3, true])
      await fail('ErrWard', adapt.connect(bob).ward, CAT, false)
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

  it('look reverse', async function () {
      const conf_ttl = 100
      await adapt.setConfig(tag, [ETH_USD_POOL_ADDR, 500, conf_ttl, true])

      let [price, ttl] = await fb.pull(adapt.address, tag)

      want(BigNumber.from(price).gt(constants.Zero)).true
      const timestamp = (await ethers.provider.getBlock("latest")).timestamp
      want(ttl).eql(BigNumber.from(timestamp + conf_ttl))
      // USDC only has 6 decimals
      let ethusd = BigNumber.from(price).div(BigNumber.from(10).pow(15));
      want(ethusd.gt(1000)).true
      want(ethusd.lt(2000)).true
  })

  it('look normal', async function () {
      await adapt.setConfig(tag, [BTC_USD_POOL_ADDR, 500, 100, false])

      let [price, ttl] = await fb.pull(adapt.address, tag)

      want(BigNumber.from(price).gt(constants.Zero)).true
      const timestamp = (await ethers.provider.getBlock("latest")).timestamp
      want(ttl).eql(BigNumber.from(timestamp + 100))
      // USDC has 6 decimals, WBTC has 8...scale down by RAY/(10^diff)
      let btcusd = BigNumber.from(price).div(BigNumber.from(10).pow(25));
      want(btcusd.gt(20000)).true
      want(btcusd.lt(30000)).true
  })

  it('look zero range', async function () {
      await adapt.setConfig(tag, [BTC_USD_POOL_ADDR, 0, 100, false])
      const errZeroRangeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Err0Range()")).slice(0, 10)
      await want(fb.pull(adapt.address, tag)).to.be.rejectedWith(errZeroRangeHash)
  })

  it('test uni wrapper', async () => {
      want(await wrap.getSqrtRatioAtTick(0)).eql(BigNumber.from(2).pow(96));
  })

})
