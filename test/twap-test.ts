import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { expect, send, fail, chai, want, snapshot, revert, b32, ray, mine } from 'minihat'
const { constants, BigNumber, utils } = ethers

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let fb
let signers
describe('twap', () => {
    const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
    const ETH_USD_POOL_ADDR = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"
    const BTC_USD_POOL_ADDR = "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35"
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let twap
    const zeroconfig = [constants.AddressZero, constants.Zero, constants.Zero]
    let pool
    const RAY = BigNumber.from(10).pow(27)
    before(async () => {
      signers = await ethers.getSigners();
      [ali, bob, cat] = signers;
      [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()

      const TWAPFactory = await ethers.getContractFactory('TWAP')
      twap = await TWAPFactory.deploy(fb.address)

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

    it('ward setConfig', async function () {
        await fail('ErrWard', twap.connect(bob).setConfig, b32('hello'), zeroconfig)
        await send(twap.ward, BOB, true);
        await send(twap.connect(bob).setConfig, b32('hello'), zeroconfig)
        await send(twap.ward, BOB, false)
        await fail('ErrWard', twap.connect(bob).setConfig, b32('hello'), zeroconfig)
    })

    it('setConfig', async function () {
        const config = [CAT, constants.One, constants.One]
        want(await twap.getConfig(tag)).eql(zeroconfig)
        await send(twap.setConfig, tag, config)
        want(await twap.getConfig(tag)).eql(config)
    })

    describe('poke', () => {
        const tag  = b32('hello')
        let config
        let timestamp
        let range = BigNumber.from(100)
        let ttl = BigNumber.from(1000)
        beforeEach(async () => {
            config = [ALI, range, ttl]
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
        })

        it('big poke success', async () => {
            await send(twap.setConfig, tag, config)
            for (let i = 0; i < 20; i++) {
                let price = Math.floor((Math.random() * 0.1 + 0.95) * 500)
                await send(fb.push, tag, b32(BigNumber.from(price)), constants.MaxUint256)
                await send(twap.poke, tag)
                await mine(hh, 20);
            }

            let [val, twapttl] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(BigNumber.from(500).toNumber(), 20)
            want(twapttl.toNumber()).to.be.closeTo(timestamp + ttl.toNumber(), 20 * 22)
        })

        it('invalid feed', async () => {
            await fail('invalid-feed-result', twap.poke, tag)
            await send(twap.setConfig, tag, [ALI, BigNumber.from(1), ttl]);
            await fail('invalid-feed-result', twap.poke, tag)
            await send(fb.push, tag, constants.HashZero, constants.MaxUint256)
            await fail('invalid-feed-result', twap.poke, tag)
            await send(fb.push, tag, b32(constants.One), constants.MaxUint256)
            await send(twap.poke, tag)

            let [val, twapttl] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(constants.One)
            want(BigNumber.from(twapttl)).to.eql(ttl)
        })

        it('tiny window', async () => {
            let price = BigNumber.from(45)
            await send(twap.setConfig, tag, [ALI, constants.One, ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(price)


            // should still assume last price continues
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(price)


            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(price)

            // skip a bunch of blocks then try again
            await mine(hh, 10)
            await send(fb.push, tag, b32(price.mul(2)), constants.MaxUint256)
            await send(twap.poke, tag)
            await mine(hh, 10)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(price.mul(2))
        })

        it('big window gradual increase to new price', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            await send(twap.setConfig, tag, [ALI, BigNumber.from(range), ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)

            await mine(hh, range / 2)

            await send(twap.poke, tag)
            let [val] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 5)

            await mine(hh, range)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.toNumber(), 5)

            await send(fb.push, tag, b32(price.div(2)), constants.MaxUint256)
            await send(twap.poke, tag)
            await mine(hh, range / 2)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.mul(3).div(4).toNumber(), 5)
            await mine(hh, range / 2)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 15)

            await mine(hh, range / 2)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 6)

            // takes a bit longer than trad twap
            await mine(hh, range)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 0)

            // try setting to 100 again, but this time skip many blocks
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            await mine(hh, range * 10)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).eql(price)
        })
    })
})


