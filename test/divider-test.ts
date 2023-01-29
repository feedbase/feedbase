import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert, b32, ray} from 'minihat'
const { constants, BigNumber, utils } = ethers

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let fb
let signers
describe('divider', () => {
    const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
    const ETH_USD_POOL_ADDR = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"
    const BTC_USD_POOL_ADDR = "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35"
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let divider
    const zeroconfig = [[], []]
    let pool
    const RAY = BigNumber.from(10).pow(27)
    before(async () => {
      signers = await ethers.getSigners();
      [ali, bob, cat] = signers;
      [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()

      const DividerFactory = await ethers.getContractFactory('Divider')
      divider = await DividerFactory.deploy(fb.address, RAY)

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
        await fail('ErrWard', divider.connect(bob).setConfig, b32('hello'), zeroconfig)
        await send(divider.ward, BOB, true);
        await send(divider.connect(bob).setConfig, b32('hello'), zeroconfig)
        await send(divider.ward, BOB, false)
        await fail('ErrWard', divider.connect(bob).setConfig, b32('hello'), zeroconfig)
    })

    it('setConfig', async function () {
        const config = [[CAT], ['0x'+b32('hello').toString('hex')]]
        want(await divider.getConfig(tag)).eql(zeroconfig)
        await send(divider.setConfig, tag, config)
        want(await divider.getConfig(tag)).eql(config)
    })

    describe('poke', () => {
        const tag  = b32('hello')
        const taga = b32('feed')
        const tagb = b32('base')
        const tagc = b32('good')
        let config
        let timestamp
        beforeEach(async () => {
            config = [[ALI, BOB, CAT], [taga, tagb, tagc]]
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
        })

        it('three opds', async () => {
            await send(divider.setConfig, tag, config)

            const timestamp = (await ethers.provider.getBlock('latest')).timestamp
            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(ray(5)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(ray(2)), timestamp + 200)

            await send(divider.poke, tag)

            const res = await fb.pull(divider.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(5), 32), BigNumber.from(timestamp + 100)])
        })

        it('divide by zero', async () => {
            // two from same src
            await send(divider.setConfig, tag, [[ALI, BOB, BOB], [taga, tagb, tagc]])

            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(ray(0)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(ray(2)), timestamp + 200)


            await fail('division by zero', divider.poke, tag)
        })

        it('fail order', async () => {
            await fail('not enough operands to divide', divider.poke, tag)
            await send(divider.setConfig, tag, zeroconfig)
            await fail('not enough operands to divide', divider.poke, tag)
            await send(divider.setConfig, tag, [[ALI], [taga]])
            await fail('not enough operands to divide', divider.poke, tag)
            await send(divider.setConfig, tag, [[ALI], [taga, tagb]])
            //
            // length mismatch check comes first
            await fail('sources.length != tags.length', divider.poke, tag)
            await send(divider.setConfig, tag, [[ALI, BOB], [taga]])
            await fail('sources.length != tags.length', divider.poke, tag)

            await send(divider.setConfig, tag, [[ALI, BOB], [taga, tagb]])
            await fail('operand is old', divider.poke, tag)
            await send(divider.setConfig, tag, [[ALI, BOB, CAT], [taga, tagb]])
            await fail('sources.length != tags.length', divider.poke, tag)

            await send(divider.setConfig, tag, [[ALI, BOB], [taga, tagb]])
            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 97)
            await fail('operand is old', divider.poke, tag)
            await send(fb.connect(bob).push, tagb, b32(ray(20)), timestamp + 100)

            await send(divider.poke, tag)
            const res = await fb.pull(divider.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(2.5), 32), BigNumber.from(timestamp + 97)])
        })

    })

})


