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
    const zeroconfig = [constants.AddressZero, constants.HashZero, constants.Zero, constants.Zero]
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
        const config = [CAT, tag, constants.One, constants.One]
        want(await twap.configs(tag)).eql(zeroconfig)
        await send(twap.setConfig, tag, config)
        const expectedConfig = [CAT, tag_hex, constants.One, constants.One]
        want(await twap.configs(tag)).eql(expectedConfig)
    })

    it('setConfig range', async function () {
        let timestamp = (await ethers.provider.getBlock('latest')).timestamp
        await fail("ErrRange", twap.setConfig, tag, [CAT,constants.HashZero, timestamp + 2, 100])
        await send(twap.setConfig, tag, [CAT, constants.HashZero, timestamp + 1, 100])
    })

    describe('poke', () => {
        const tag  = b32('hello')
        const dtag = b32('hellotwap')
        let config
        let timestamp
        let range = BigNumber.from(100)
        let ttl = BigNumber.from(1000)
        beforeEach(async () => {
            config = [ALI, tag, range, ttl]
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
        })

        it('big poke success', async () => {
            await send(twap.setConfig, dtag, config)
            for (let i = 0; i < 20; i++) {
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
            await send(twap.setConfig, dtag, [ALI, tag, range, BigNumber.from(46)])
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
            await mine(hh, range.toNumber())
            await send(twap.poke, dtag)
            await send(fb.push, tag, b32(ray(3)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)

            // pseudo clamps to last
            await mine(hh, range.toNumber() * 1000000000)
            await send(twap.poke, dtag)
            let [val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray(3))

            // clamp edge
            await send(fb.push, tag, b32(ray(7)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)
            await mine(hh, range.toNumber())
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray(7))

            // no clamp if waited less than range
            await send(fb.push, tag, b32(ray(10)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)
            await mine(hh, range.toNumber())
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).lt(ray(10))).true
        })

        it('tiny window', async () => {
            let price = BigNumber.from(45)
            await send(twap.setConfig, dtag, [ALI, tag, constants.One, ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, dtag)
            let [val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price)


            // should still assume last price continues
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price)


            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price)

            // skip a bunch of blocks then try again
            await mine(hh, 10)
            await send(fb.push, tag, b32(price.mul(2)), constants.MaxUint256)
            await send(twap.poke, dtag)
            await mine(hh, 10)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(price.mul(2))
        })

        it('reconfig', async () => {
            await send(twap.setConfig, dtag, config)
            await send(fb.push, tag, b32(ray(1)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)
            await mine(hh, range.toNumber())
            await send(twap.poke, dtag)
            await send(fb.push, tag, b32(ray(3)), constants.MaxUint256.sub(45))
            await send(twap.poke, dtag)
            await mine(hh, range.toNumber())
            await send(twap.poke, dtag);

            await send(twap.setConfig, dtag, [ALI, tag, range / 10, 20000])
            await send(twap.poke, dtag);
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray(3))
            await mine(hh, range.toNumber() / 10)
            await send(twap.poke, dtag);
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).to.eql(ray(3))
            
            const newTag = Buffer.from('OTHERTAG'.padStart(32, '\0'))
            await send(twap.setConfig, newTag, [ALI, tag, range / 10, 20000])
            await send(fb.push, tag, b32(ray(72)), constants.MaxUint256.sub(45))
            await send(twap.poke, newTag)
            await mine(hh, range / 10);
            await send(twap.poke, newTag)
            ;[val,] = await fb.pull(twap.address, newTag)
            want(BigNumber.from(val)).to.eql(ray(72))

        })


        it('big window gradual increase to new price', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            await send(twap.setConfig, dtag, [ALI, tag, BigNumber.from(range), ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, dtag)

            await mine(hh, range / 2)

            await send(twap.poke, dtag)
            let [val] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 5)

            await mine(hh, range)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.toNumber(), 5)

            await send(fb.push, tag, b32(price.div(2)), constants.MaxUint256)
            await send(twap.poke, dtag)
            await mine(hh, range / 2)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.mul(3).div(4).toNumber(), 5)
            await mine(hh, range / 2)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 15)

            await mine(hh, range / 2)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 6)

            // takes a bit longer than trad twap
            await mine(hh, range)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.div(2).toNumber(), 0)

            // try setting to 100 again, but this time skip many blocks
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, dtag)
            await mine(hh, range * 10)
            await send(twap.poke, dtag)
            ;[val,] = await fb.pull(twap.address, dtag)
            want(BigNumber.from(val)).eql(price)
        })

        it('assume current spot for elapsed time, not last spot', async () => {
            let price = BigNumber.from(100)
            let range = 100000
            await send(twap.setConfig, tag, [ALI, tag, BigNumber.from(range), ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            await mine(hh, range)
            await send(fb.push, tag, b32(price.mul(2)), constants.MaxUint256)
            await send(twap.poke, tag)

            // ignores the first value
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.mul(2).toNumber(), 0)

            await mine(hh, range / 2)
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)

            // assumes uniform price * 2 in last window
            ;[val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.mul(3).div(2).toNumber(), 0)
        })

        it('linear progression, prior pokes do not effect result', async () => {
            let price = BigNumber.from(1000)
            let range = 10000
            await send(twap.setConfig, tag, [ALI, tag, BigNumber.from(range), ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            await mine(hh, range)
            await send(twap.poke, tag)

            await send(fb.push, tag, b32(price.mul(0)), constants.MaxUint256)

            // transitioning from 1000 to 0. After 20% of the range period the price should be 800, it is
            await mine(hh, range / 5)
            await send(twap.poke, tag)
            let [val,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val).toNumber()).to.be.closeTo(price.mul(8).div(10).toNumber(), 1)

            // now waiting another 10% would expect price should be 70% of the original price,
            // it's dropping by 10% of gap from last value to feed (800),
            // so dropping by about 80 instead of 100
            // this test fails, price progression can be slowed by poking
            await mine(hh, range / 10)
            await send(twap.poke, tag)
            let [val2,] = await fb.pull(twap.address, tag)
            want(BigNumber.from(val2).toNumber()).to.be.closeTo(price.mul(7).div(10).toNumber(), 1)
        })

        it('frequent pokes', async () => {
            let price = ray(1000)
            let range = 1000
            let granularity = 10;
            await send(twap.setConfig, tag, [ALI, tag, BigNumber.from(range), ttl]);
            await send(fb.push, tag, b32(price), constants.MaxUint256)
            await send(twap.poke, tag)
            await mine(hh, range)
            await send(twap.poke, tag)

            await send(fb.push, tag, b32(price.mul(2)), constants.MaxUint256)
            let time = range / granularity
            for (let i = 0; i < 100000000; i += 1) {
                await mine(hh, time - 1)
                await send(twap.poke, tag)
                let [val,] = await fb.pull(twap.address, tag)
                console.log(i * time, val)
                if (BigNumber.from(val).gt(price.mul(199).div(100))) break;
            }
        })
    })
})


