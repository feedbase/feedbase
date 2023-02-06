import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { expect, send, fail, chai, want, snapshot, revert, b32, ray, mine, BANKYEAR, RAY } from 'minihat'
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
        false
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
            constants.One, constants.One, true
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
            config = [ALI, range, ttl]
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
        })

        const trypoke = async (tag, expectval, expectttl, tol=0) => {
            await send(progression.poke, tag)
            let [val, ttl] = await fb.pull(progression.address, tag)
            want(BigNumber.from(val).div(RAY).toNumber()).closeTo(expectval, tol);
            want(BigNumber.from(ttl)).eql(expectttl);
        }

        it('poke valid but zero price, then onward', async () => {
            await send(fb.push, b32('hi'), b32(ray(0)), BigNumber.from(constants.MaxUint256))
            await send(fb.push, b32('bye'), b32(ray(0)), BigNumber.from(constants.MaxUint256))
            await send(progression.setConfig, tag, [
                ALI, b32('hi'), ALI, b32('bye'),
                timestamp, timestamp + BANKYEAR, false
            ])

            await trypoke(tag, 0, constants.MaxUint256)
            await mine(hh, BANKYEAR / 2)
            await trypoke(tag, 0, constants.MaxUint256)
            await trypoke(tag, 0, constants.MaxUint256)
            await send(fb.push, b32('bye'), b32(ray(1000)), BigNumber.from(constants.MaxUint256))
            await trypoke(tag, 500, constants.MaxUint256, 10)
            await send(fb.push, b32('hi'), b32(ray(1000)), BigNumber.from(constants.MaxUint256))
            await trypoke(tag, 1000, constants.MaxUint256, 20)
            await trypoke(tag, 1000, constants.MaxUint256, 20)
            await trypoke(tag, 1000, constants.MaxUint256, 20)
            await trypoke(tag, 1000, constants.MaxUint256, 20)
            await mine(hh, BANKYEAR / 2)
            await trypoke(tag, 1000, constants.MaxUint256, 20)
            // hi has no effect, bye does
            await send(fb.push, b32('hi'), b32(ray(2000)), BigNumber.from(constants.MaxUint256))
            await trypoke(tag, 1000, constants.MaxUint256, 20)
            await send(fb.push, b32('bye'), b32(ray(2000)), BigNumber.from(constants.MaxUint256))
            await trypoke(tag, 2000, constants.MaxUint256, 20)
        })

        it('timestamp min', async () => {
            await send(fb.push, b32('hi'), b32(ray(1)), BigNumber.from(500))
            await send(fb.push, b32('bye'), b32(ray(1)), BigNumber.from(timestamp + 1000))
            await send(progression.setConfig, tag, [
                ALI, b32('hi'), ALI, b32('bye'),
                timestamp, timestamp + BANKYEAR, false
            ])
            await trypoke(tag, 1, BigNumber.from(500))
            await send(fb.push, b32('hi'), b32(ray(1)), BigNumber.from(timestamp + 1000))
            await send(fb.push, b32('bye'), b32(ray(1)), BigNumber.from(500))
            await trypoke(tag, 1, BigNumber.from(500))
        })

        it('realistic pokes', async () => {
            await send(fb.connect(ali).push, b32('ali'), b32(ray(1)), BigNumber.from(timestamp + BANKYEAR * 2))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(2)), BigNumber.from(timestamp + BANKYEAR))
            await send(progression.setConfig, tag, [
                ALI, b32('ali'), BOB, b32('bob'),
                timestamp, timestamp + BANKYEAR, false
            ])

            await trypoke(tag, 1, BigNumber.from(timestamp + BANKYEAR))

            // x10ing bob price has minimal effect because it's so early
            await send(fb.connect(bob).push, b32('bob'), b32(ray(10)), BigNumber.from(timestamp + BANKYEAR))
            // last == 1
            // prog == 1 * 1 + 0 * 10 == 1
            await trypoke(tag, 1, BigNumber.from(timestamp + BANKYEAR))

            await mine(hh, BANKYEAR / 2)
            // last == 1
            // prog == 0.5 * 1 + 0.5 * 10 == 6
            // price == 0.5 * 1 + 0.5 * 10 == 6
            await trypoke(tag, 1, BigNumber.from(timestamp + BANKYEAR))

            await send(fb.connect(bob).push, b32('bob'), b32(ray(50)), BigNumber.from(timestamp + BANKYEAR))
            // last: 1
            // prog: 0.5 * 1 + 0.5 * 10 = 5.5
            // price: 0.5 * 1 + 0.5 * 50 = 25.5
            await trypoke(tag, 4, BigNumber.from(timestamp + BANKYEAR))

            await mine(hh, BANKYEAR / 2)
            // last == 4
            // prog == 50
            // price == 50
            await trypoke(tag, 4, BigNumber.from(timestamp + BANKYEAR))
            await send(fb.connect(ali).push, b32('ali'), b32(ray(4000)), BigNumber.from(timestamp + BANKYEAR))
            await trypoke(tag, 4, BigNumber.from(timestamp + BANKYEAR))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(25)), BigNumber.from(timestamp + BANKYEAR))
            
            // last == 4
            // prog == 50
            // price == 80
            await trypoke(tag, 2, BigNumber.from(timestamp + BANKYEAR))
            await mine(hh, BANKYEAR)
            await trypoke(tag, 2, BigNumber.from(timestamp + BANKYEAR))
            await send(fb.connect(bob).push, b32('bob'), b32(ray(12.5)), BigNumber.from(timestamp + BANKYEAR))
            await trypoke(tag, 1, BigNumber.from(timestamp + BANKYEAR))
        })
    })
})


