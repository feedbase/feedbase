import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, ray, mine } from 'minihat'
const { constants, BigNumber } = ethers

const debug = require('debug')('feedbase:test')

let fb
let signers
describe('twap', () => {
    let tag, tag_hex, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let twap
    const THO = BigNumber.from(10 ** 3)
    const zeroconfig = [constants.AddressZero, constants.HashZero, constants.Zero, constants.Zero, constants.Zero]
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
      tag_hex = '0x' + tag.toString('hex')
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
        const config = [CAT, tag, constants.One, THO, constants.One]
        want(await twap.getConfig(tag)).eql(zeroconfig)
        await send(twap.setConfig, tag, config)
        const expectedConfig = [CAT, tag_hex, constants.One, THO, constants.One]
        want(await twap.getConfig(tag)).eql(expectedConfig)
    })

    it('setConfig range', async function () {
        let timestamp = (await ethers.provider.getBlock('latest')).timestamp
        await fail("ErrRange", twap.setConfig, tag, [CAT,constants.HashZero, timestamp + 2, THO, 100])
        await send(twap.setConfig, tag, [CAT, constants.HashZero, timestamp + 1, THO, 100])
    })

    describe('poke', () => {
        const tag  = b32('hello')
        const dtag = b32('hellotwap')
        let config
        let timestamp
        let range = BigNumber.from(100)
        let ttl = BigNumber.from(1000)
        beforeEach(async () => {
            config = [ALI, tag, range, 10 ** 3, ttl]
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
        })

        const cycle = async (range, n, dtag) => {
            for (let i = 0; i < n; i++) {
                await mine(hh, range)
                await send(twap.poke, dtag)
            }
        }

        it('big poke success', async () => {
            await send(twap.setConfig, dtag, config)
            for (let i = 0; i < 40; i++) {
                let price = Math.floor((Math.random() * 0.1 + 0.95) * 500)
                await send(fb.push, tag, b32(BigNumber.from(price)), constants.MaxUint256)
                await send(twap.poke, dtag)
                await mine(hh, 20);
            }

            let [val, twapttl] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(BigNumber.from(500).toNumber(), 20)
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
        })

        it('advance ttl from source ttl', async () => {
            await send(twap.setConfig, dtag, config)
            await send(fb.push, tag, b32(ray(1)), BigNumber.from(45))
            await send(twap.poke, dtag)
            let [,twapttl] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(twapttl)).eql(ttl.add(45))
        })

        it('no time elapsed', async () => {
            await send(twap.setConfig, dtag, config)
            await send(fb.push, tag, b32(ray(1)), BigNumber.from(45))
            await hh.network.provider.send("evm_setAutomine", [false])
            let poke0 = await twap.poke(dtag, {gasLimit: 300000})
            let poke1 = await twap.poke(dtag, {gasLimit: 300000})
            await mine(hh, 1);
            await poke0.wait()
            await want(poke1.wait()).rejectedWith('')
            await hh.network.provider.send("evm_setAutomine", [true])
        })

        it("don't advance from max ttl", async () => {
            await send(twap.setConfig, dtag, config)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256)
            await send(twap.poke, dtag)
            let [,twapttl] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
        })

        it("advance, but not past max ttl", async () => {
            await send(twap.setConfig, dtag, [ALI, tag, range, THO, BigNumber.from(46)])
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)
            let [,twapttl] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(46))
            ;[,twapttl] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(twapttl)).eql(constants.MaxUint256)
        })

        it('big jump, more than range', async () => {
            await send(twap.setConfig, dtag, config)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)

            // twap output gradually approaches spot when spot constant
            await cycle(range.toNumber(), 10, dtag);

            let [val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).lt(ray(1))).true

            await cycle(range.toNumber(), 90, dtag)

            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).eql(ray(1))


            await send(twap.poke, dtag)
            await send(fb.push, tag, b32(ray(3)), constants.MaxUint256.sub(45))
            // pseudo clamps to last
            await mine(hh, range.toNumber() * 1000000000)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray((3 + 1) / 2))

            // clamp edge
            await send(fb.push, tag, b32(ray(7)), constants.MaxUint256.sub(45))
            await mine(hh, range.toNumber())
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray(7 + 2).div(2))

            // no clamp if waited less than range
            await send(fb.push, tag, b32(ray(10)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)
            await mine(hh, range.toNumber())
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).lt(ray(10))).true
        })

        it('tiny window', async () => {
            // sometimes need to subtract 1 from expected output for rounding

            let price = ray(45)
            await send(twap.setConfig, dtag, [ALI, tag, constants.One, THO, ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)

            await cycle(1, 300, dtag)

            let [val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price.sub(1))

            // should still assume last price continues
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price.sub(1))


            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price.sub(1))

            // skip a bunch of blocks then try again
            await mine(hh, 10)
            await send(fb.push, tag, b32(price.mul(2)), constants.MaxUint256)
            await send(twap.poke, dtag)
            await mine(hh, 10)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price.mul(3).div(2).add(price.mul(2)).div(2).sub(1))
        })

        it('reconfig', async () => {
            await send(twap.setConfig, dtag, config)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(45))

            await cycle(range.toNumber(), 90, dtag)

            let [val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray(1).sub(1))

            await send(fb.push, tag, b32(ray(3)), constants.MaxUint256.sub(45))
            await cycle(range.toNumber(), 90, dtag)

            await send(twap.poke, dtag);

            let [val_pre,] = await fb.pull(twap.address, dtag)
            await send(twap.setConfig, dtag, [ALI, tag, range / 10, THO, 20000])
            await send(twap.poke, dtag);
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(BigNumber.from(val_pre))

            await mine(hh, range.toNumber() / 10)
            await send(twap.poke, dtag);
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray(3).sub(1))

            const newTag = Buffer.from('OTHERTAG'.padStart(32, '\0'))
            await send(twap.setConfig, newTag, [ALI, tag, range / 10, THO, 20000])
            await send(fb.push, tag, b32(ray(72)), constants.MaxUint256.sub(45))
            await mine(hh, range / 10);
            await send(twap.poke, newTag)
            ;[val,] = await fb.pull(twap.address, newTag)
            want(BigNumber.from(val)).to.eql(ray(72).div(2))

        })


        it('big window gradual increase to new price', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            await send(twap.setConfig, dtag, [ALI, tag, BigNumber.from(range), THO, ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, dtag)

            await mine(hh, range / 2)

            await send(twap.poke, dtag)
            let [val] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(4).toNumber(), 5)

            await cycle(range / 2, 90, dtag)

            await mine(hh, range)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.toNumber(), 5)


            await send(fb.push, tag, b32(price.div(2)), constants.MaxUint256)
            await send(twap.poke, dtag)
            await mine(hh, range / 2)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.mul(7).div(8).toNumber(), 5)

            await cycle(range / 2, 4, dtag)

            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 15)

            await cycle(range / 2, 2, dtag)

            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 6)

            await cycle(range / 2, 10, dtag)

            // takes a bit longer than trad twap
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 0)

            // try setting to 100 again, but this time skip many blocks
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, dtag)
            await mine(hh, range * 10)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).eql(price.mul(3).div(4))
        })

        it('assume current spot for elapsed time, not last spot', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            await send(twap.setConfig, tag, [ALI, tag, BigNumber.from(range), THO, ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            await mine(hh, range)
            await send(fb.push, tag, b32(price.mul(2)), constants.MaxUint256)
            await send(twap.poke, tag)

            // ignores the first value
            // only outputs half spot, because it gradually approaches
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.toNumber(), 0)

            await mine(hh, range / 2)
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)

            // assumes uniform price * 2 in last window
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.toNumber(), 0)

            await mine(hh, range / 2)
            await send(fb.push, tag, b32(constants.Zero), constants.MaxUint256)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.mul(3).div(4).toNumber(), 0)
        })

        it('current value weighted 0', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            // set weight to 0
            await send(twap.setConfig, tag, [ALI, tag, BigNumber.from(range), 0, ttl]);

            // push initial price and poke
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)

            // wait full range, pump price and poke again
            await mine(hh, range)
            await send(fb.push, tag, b32(price.mul(2)), constants.MaxUint256)
            await send(twap.poke, tag)

            // should just be last spot price
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).eql(price.mul(2))

            // ok but what if wait half range this time...
            await mine(hh, range / 2)
            await send(fb.push, tag, b32(constants.Zero), constants.MaxUint256)
            await send(twap.poke, tag)

            // it poked in the middle of a window, so should only change by about half
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.toNumber(), 1)

            // cycling should eventually reach 0
            await cycle(range / 2, 10, tag)
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).eql(0)
        })

        it('old value weighted low', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            // set weight to 0, wait for range
            await send(twap.setConfig, tag, [ALI, tag, BigNumber.from(range), THO.div(2), ttl]);
            await mine(hh, range)

            // push initial price and poke
            // output should be (0 * 1/2 + price * 1)/1.5 = price/1.5
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            let res = BigNumber.from(val)
            want(res).eql(price.mul(2).div(3))

            // wait full range, pump price and poke again
            await mine(hh, range)
            await send(fb.push, tag, b32(res.mul(2)), constants.MaxUint256)
            await send(twap.poke, tag)

            // should average in the new spot
            // output should be (res * 1/2 + res * 2) / 1.5 = res * 5/3
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).eql(res.mul(5).div(3))
            res = BigNumber.from(val)

            // ok but what if wait half range this time...
            await mine(hh, range / 2)
            await send(fb.push, tag, b32(constants.Zero), constants.MaxUint256)
            await send(twap.poke, tag)

            // it poked in the middle of a window, so should only change by about half
            // of what it would normally
            // output should be 2 * ((res * 1/2 + 0) / 1.5) = res * 2/3
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(res.mul(2).div(3))

            // cycling should eventually reach 0
            await cycle(range / 2, 13, tag)
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).eql(0)
        })

        it('old value weighted high', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            // set weight to 0, wait for range
            await send(twap.setConfig, tag, [ALI, tag, BigNumber.from(range), THO.mul(2), ttl]);
            await mine(hh, range)

            // push initial price and poke
            // output should be (0 * 2 + price * 1)/3 = price/3
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            ;[val,] = await fb.pull(twap.address, tag)
            let res = BigNumber.from(val)
            want(res).eql(price.div(3))

            // wait full range, pump price and poke again
            await mine(hh, range)
            await send(fb.push, tag, b32(res.mul(2)), constants.MaxUint256)
            await send(twap.poke, tag)

            // should average in the new spot
            // output should be (res * 2 + res * 2) / 3 = res * 4/3
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).eql(res.mul(4).div(3))
            res = BigNumber.from(val)

            // ok but what if wait half range this time...
            await mine(hh, range / 2)
            await send(fb.push, tag, b32(constants.Zero), constants.MaxUint256)
            await send(twap.poke, tag)

            // it poked in the middle of a window, so should only change by about half
            // of what it would normally
            // with full window hop should be 2 * ((res * 1/2 + 0) / 1.5) = res * 2/3
            // with half window hop should be res - 0.5 * (res - res * 2/3) = res * 5/6
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val)).to.eql(res.mul(5).div(6))

            // cycling should eventually reach 0
            await cycle(range / 2, 25, tag)
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).eql(0)
        })
    })
})
