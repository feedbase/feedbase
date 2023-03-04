import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, ray, mine } from 'minihat'
const { constants, BigNumber } = ethers

const debug = require('debug')('feedbase:test')

let fb
let signers
describe('twap', () => {
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let twap
    const zeroconfig = [constants.AddressZero, constants.Zero, constants.Zero]
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

    it('setConfig range', async function () {
        let timestamp = (await ethers.provider.getBlock('latest')).timestamp
        await fail("ErrRange", twap.setConfig, tag, [CAT, timestamp + 2, 100])
        await send(twap.setConfig, tag, [CAT, timestamp + 1, 100])
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
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
        })

        it('advance ttl from source ttl', async () => {
            await send(twap.setConfig, tag, config)
            await send(fb.push, tag, b32(ray(1)), BigNumber.from(45))
            await send(twap.poke, tag)
            let [,twapttl] = await fb.pull(twap.address, tag)
            want(BigNumber.from(twapttl)).eql(ttl.add(45))
        })

        it('no time elapsed', async () => {
            await send(twap.setConfig, tag, config)
            await send(fb.push, tag, b32(ray(1)), BigNumber.from(45))
            await hh.network.provider.send("evm_setAutomine", [false])
            let poke0 = await twap.poke(tag, {gasLimit: 300000})
            let poke1 = await twap.poke(tag, {gasLimit: 300000})
            await mine(hh, 1);
            await poke0.wait()
            await want(poke1.wait()).rejectedWith('')
            await hh.network.provider.send("evm_setAutomine", [true])
        })

        it("don't advance from max ttl", async () => {
            await send(twap.setConfig, tag, config)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256)
            await send(twap.poke, tag)
            let [,twapttl] = await fb.pull(twap.address, tag)
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
        })

        it("advance, but not past max ttl", async () => {
            await send(twap.setConfig, tag, [ALI, range, BigNumber.from(46)])
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)
            let [,twapttl] = await fb.pull(twap.address, tag)
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(46))
            ;[,twapttl] = await fb.pull(twap.address, tag)
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
        })

        it('big jump, more than range', async () => {
            await send(twap.setConfig, tag, config)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)
            await mine(hh, range.toNumber())
            await send(twap.poke, tag)
            await send(fb.push, tag, b32(ray(3)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)

            // pseudo clamps to last
            await mine(hh, range.toNumber() * 1000000000)
            await send(twap.poke, tag)
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(ray(3))

            // clamp edge
            await send(fb.push, tag, b32(ray(7)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)
            await mine(hh, range.toNumber())
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(ray(7))

            // no clamp if waited less than range
            await send(fb.push, tag, b32(ray(10)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)
            await mine(hh, range.toNumber())
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).lt(ray(10))).true
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

        it('reconfig', async () => {
            await send(twap.setConfig, tag, config)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)
            await mine(hh, range.toNumber())
            await send(twap.poke, tag)
            await send(fb.push, tag, b32(ray(3)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)
            await mine(hh, range.toNumber())
            await send(twap.poke, tag);

            await send(twap.setConfig, tag, [ALI, range / 10, 20000])
            await send(twap.poke, tag);
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(ray(3))
            await mine(hh, range.toNumber() / 10)
            await send(twap.poke, tag);
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(ray(3))

            await send(fb.push, tag, b32(ray(72)), constants.MaxUint256.sub(45))
            await send(twap.poke, tag)
            await mine(hh, range / 10);
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(ray(72))
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


