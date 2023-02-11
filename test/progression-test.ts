import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { expect, send, fail, chai, want, snapshot, revert, b32, ray, mine, BANKYEAR, RAY, warp } from 'minihat'
const { constants, BigNumber, utils } = ethers

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let fb
let signers
describe('progression', () => {
    const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let progression
    const zeroconfig = [
        constants.AddressZero,
        constants.HashZero,
        constants.AddressZero,
        constants.HashZero,
        constants.Zero,
        constants.Zero,
        constants.Zero,
    ]
    let pool
    const RAY = BigNumber.from(10).pow(27)
    before(async () => {
      signers = await ethers.getSigners();
      [ali, bob, cat] = signers;
      [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()

      const ProgressionFactory = await ethers.getContractFactory('Progression')
      progression = await ProgressionFactory.deploy(fb.address)

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
        await fail('ErrWard', progression.connect(bob).setConfig, b32('hello'), zeroconfig)
        await send(progression.ward, BOB, true);
        await send(progression.connect(bob).setConfig, b32('hello'), zeroconfig)
        await send(progression.ward, BOB, false)
        await fail('ErrWard', progression.connect(bob).setConfig, b32('hello'), zeroconfig)
    })

    it('setConfig', async function () {
        const config = [
            ALI, '0x'+b32('ali').toString('hex'),
            BOB, '0x'+b32('bob').toString('hex'),
            constants.One, constants.One, constants.One
        ]
        want(await progression.configs(tag)).eql(zeroconfig)
        await send(progression.setConfig, tag, config)
        want(await progression.configs(tag)).eql(config)
    })

    describe('poke', () => {
        const tag  = b32('hello')
        let config
        let timestamp
        let range = BigNumber.from(100)
        let ttl = BigNumber.from(1000)
        beforeEach(async () => {
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
        })

        const trypoke = async (tag, expectval, expectttl, tol=0) => {
            await send(progression.poke, tag)
            let [val, ttl] = await fb.pull(progression.address, tag)
            if (BigNumber.from(val).gt(expectval.add(tol))) {
                chai.assert(false, `expected ${expectval.add(tol)} gt actual ${BigNumber.from(val)}`)
            }
            if (BigNumber.from(val).lt(expectval.sub(tol))) {
                chai.assert(false, `expected ${expectval.sub(tol)} lt actual ${BigNumber.from(val)}`)
            }
 
            want(BigNumber.from(val).lt(expectval.sub(tol))).false;
            want(BigNumber.from(ttl)).eql(expectttl);
        }

        it('poke zero source price, then onward', async () => {
            await send(fb.push, b32('hi'), b32(ray(0)), BigNumber.from(constants.MaxUint256))
            await send(fb.push, b32('bye'), b32(ray(0)), BigNumber.from(constants.MaxUint256))
            await send(progression.setConfig, tag, [
                ALI, b32('hi'), ALI, b32('bye'),
                timestamp, timestamp + BANKYEAR, 1
            ])

            await fail("can't initialize when either source is 0", progression.poke, tag)
            await mine(hh, BANKYEAR / 2)
            await fail("can't initialize when either source is 0", progression.poke, tag)
            await fail("can't initialize when either source is 0", progression.poke, tag)
            await send(fb.push, b32('bye'), b32(ray(1000)), BigNumber.from(constants.MaxUint256))
            await fail("can't initialize when either source is 0", progression.poke, tag)
            await send(fb.push, b32('hi'), b32(ray(1000)), BigNumber.from(constants.MaxUint256))
            await trypoke(tag, ray(1000), constants.MaxUint256, ray(0.0001))
            await trypoke(tag, ray(1000), constants.MaxUint256, ray(0.0001))
            await trypoke(tag, ray(1000), constants.MaxUint256, ray(0.0001))
            await trypoke(tag, ray(1000), constants.MaxUint256, ray(0.0001))
            await mine(hh, BANKYEAR / 2)
            await trypoke(tag, ray(1000), constants.MaxUint256, ray(0.0001))
            // hi has no effect at this point, bye does
            await send(fb.push, b32('hi'), b32(ray(2000)), BigNumber.from(constants.MaxUint256))
            await trypoke(tag, ray(1000), constants.MaxUint256, ray(0.0001))
            await send(fb.push, b32('bye'), b32(ray(2000)), BigNumber.from(constants.MaxUint256))
            await trypoke(tag, ray(2000), constants.MaxUint256, ray(0.0001))
        })

        it('timestamp min', async () => {
            await send(fb.push, b32('hi'), b32(ray(1)), BigNumber.from(500))
            await send(fb.push, b32('bye'), b32(ray(1)), BigNumber.from(timestamp + 1000))
            await send(progression.setConfig, tag, [
                ALI, b32('hi'), ALI, b32('bye'),
                timestamp, timestamp + BANKYEAR, 1
            ])
            await trypoke(tag, RAY, BigNumber.from(500), 100)
            await send(fb.push, b32('hi'), b32(ray(1)), BigNumber.from(timestamp + 1000))
            await send(fb.push, b32('bye'), b32(ray(1)), BigNumber.from(500))
            await trypoke(tag, RAY, BigNumber.from(500), 100)
        })

        it('realistic pokes', async () => {
            await send(fb.connect(ali).push, b32('ali'), b32(ray(1)), BigNumber.from(timestamp + BANKYEAR * 2))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(2)), BigNumber.from(timestamp + BANKYEAR))
            await send(progression.setConfig, tag, [
                ALI, b32('ali'), BOB, b32('bob'),
                timestamp, timestamp + BANKYEAR, 1
            ])

            await trypoke(tag, ray(1), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))

            // x10ing bob price has minimal effect because it's so early
            await send(fb.connect(bob).push, b32('bob'), b32(ray(10)), BigNumber.from(timestamp + BANKYEAR))
            await trypoke(tag, ray(1), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))

            await mine(hh, BANKYEAR / 2)
            await trypoke(tag, ray(1), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))

            await send(fb.connect(bob).push, b32('bob'), b32(ray(50)), BigNumber.from(timestamp + BANKYEAR))
            // 1/2 + 5/2, because b increased 10->50 (5x)
            await trypoke(tag, ray(3), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))

            await mine(hh, BANKYEAR / 2)

            await trypoke(tag, ray(3), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))
            await send(fb.connect(ali).push, b32('ali'), b32(ray(4000)), BigNumber.from(timestamp + BANKYEAR))
            // ali doesn't matter anymore
            await trypoke(tag, ray(3), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))

            await send(fb.connect(bob).push, b32('bob'), b32(ray(25)), BigNumber.from(timestamp + BANKYEAR))
            // but bob does
            await trypoke(tag, ray(1.5), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))
            await mine(hh, BANKYEAR * 10)
            // still 1.5 after all these years
            await trypoke(tag, ray(1.5), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))
            await mine(hh, BANKYEAR * 10)

            // pump bob 4x
            await send(fb.connect(bob).push, b32('bob'), b32(ray(100)), BigNumber.from(timestamp + BANKYEAR))
            await send(fb.connect(ali).push, b32('ali'), b32(ray(0)), BigNumber.from(timestamp + BANKYEAR))
            await trypoke(tag, ray(6), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))

            // set bob to 0, check that it doesn't break
            await send(fb.connect(bob).push, b32('bob'), b32(ray(0)), BigNumber.from(timestamp + BANKYEAR))
            await trypoke(tag, ray(0), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(100)), BigNumber.from(timestamp + BANKYEAR))
            await trypoke(tag, ray(6), BigNumber.from(timestamp + BANKYEAR), ray(0.0001))
        })

        it('bounce back from 0', async () => {
            let alittl = timestamp + BANKYEAR * 4
            let bobttl = timestamp + BANKYEAR * 2
            await send(fb.connect(ali).push, b32('ali'), b32(ray(1)), BigNumber.from(alittl))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(2)), BigNumber.from(bobttl))
            await send(progression.setConfig, tag, [
                ALI, b32('ali'), BOB, b32('bob'),
                timestamp, timestamp + BANKYEAR, 1
            ])

            await warp(hh, timestamp + BANKYEAR / 2)
            await trypoke(tag, ray(1.5), BigNumber.from(bobttl), ray(0.0001))

            await send(fb.connect(ali).push, b32('ali'), b32(ray(0)), BigNumber.from(alittl))
            await trypoke(tag, ray(0.75), BigNumber.from(bobttl), ray(0.0001))
            await send(fb.connect(ali).push, b32('ali'), b32(ray(1)), BigNumber.from(alittl))
            // should stay at previous value since before-0 pricea was cached
            await trypoke(tag, ray(0.75), BigNumber.from(bobttl), ray(0.0001))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(0)), BigNumber.from(bobttl))
            await trypoke(tag, ray(0.375), BigNumber.from(bobttl), ray(0.0001))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(2)), BigNumber.from(bobttl))
            await trypoke(tag, ray(0.375), BigNumber.from(bobttl), ray(0.0001))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(0)), BigNumber.from(bobttl))
            await trypoke(tag, ray(0.1875), BigNumber.from(bobttl), ray(0.0001))
            // bounce back, but this time to half what bob was before
            await send(fb.connect(bob).push, b32('bob'), b32(ray(1)), BigNumber.from(bobttl))
            await trypoke(tag, ray(0.1406), BigNumber.from(bobttl), ray(0.0001))

            await warp(hh, timestamp + BANKYEAR * 2)
            await trypoke(tag, ray(0.1406), BigNumber.from(bobttl), ray(0.0001))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(0)), BigNumber.from(bobttl))
            await trypoke(tag, ray(0), BigNumber.from(bobttl), ray(0.0001))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(1)), BigNumber.from(bobttl))
            // should bounce back to full amount since no more rebalancing
            await trypoke(tag, ray(0.1406), BigNumber.from(bobttl), ray(0.0001))
        })

        it('rebalance at a weird point', async () => {
            let alittl = timestamp + BANKYEAR * 4
            let bobttl = timestamp + BANKYEAR * 2
            await send(fb.connect(ali).push, b32('ali'), b32(ray(1)), BigNumber.from(alittl))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(2)), BigNumber.from(bobttl))
            await send(progression.setConfig, tag, [
                ALI, b32('ali'), BOB, b32('bob'),
                timestamp, timestamp + BANKYEAR, 1
            ])

            await trypoke(tag, ray(1), BigNumber.from(bobttl), ray(0.0001))
            await warp(hh, timestamp + BANKYEAR / 4)
            await send(fb.connect(bob).push, b32('bob'), b32(ray(8)), BigNumber.from(bobttl))
            await trypoke(tag, ray(1.75), BigNumber.from(bobttl), ray(0.0001))
            await warp(hh, timestamp + BANKYEAR * 3 / 4)
            await send(fb.connect(ali).push, b32('ali'), b32(ray(10)), BigNumber.from(alittl))
            await trypoke(tag, ray(1.75 * (0.75 + 0.25 * 10)), BigNumber.from(bobttl), ray(0.0001))
        })
    })
})
