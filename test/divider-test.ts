import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, wad, ray, rad, WAD, RAY, RAD} from 'minihat'
const { BigNumber } = ethers

const debug = require('debug')('feedbase:test')

let fb
let signers
describe('divider', () => {
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let divider
    let minconfig
    const zeroconfig = [[], [], []]
    before(async () => {
      signers = await ethers.getSigners();
      [ali, bob, cat] = signers;
      [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()

      const DividerFactory = await ethers.getContractFactory('Divider')
      divider = await DividerFactory.deploy(fb.address, RAY)

      minconfig = [
            [ALI, BOB],
            [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob'))],
            [RAY, RAY]
        ]

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

    it('getConfig', async () => {
        let config = [
            [ali.address, bob.address],
            [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob'))],
            [RAY, WAD]
        ]
        await send(divider.setConfig, b32('hello'), config)
        want(await divider.getConfig(b32('hello'))).eql(config)
    })

    it('ward setConfig', async function () {
        await fail('ErrWard', divider.connect(bob).setConfig, b32('hello'), minconfig)
        await send(divider.ward, BOB, true);
        await send(divider.connect(bob).setConfig, b32('hello'), minconfig)
        await send(divider.ward, BOB, false)
        await fail('ErrWard', divider.connect(bob).setConfig, b32('hello'), minconfig)
    })

    it('setConfig', async function () {
        want(await divider.getConfig(tag)).eql(zeroconfig)

        let config = [[CAT], ['0x'+b32('hello').toString('hex')], [RAY]]
        await fail('ErrShort', divider.setConfig, tag, config)

        config = [[ALI, BOB, CAT],
                  [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob'))],
                  [RAY, RAY]]
        await fail('ErrMatch', divider.setConfig, tag, config)

        config = [[ALI, BOB],
                  [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob'))],
                  [RAY, RAY, RAY]]
        await fail('ErrMatch', divider.setConfig, tag, config)

        await send(divider.setConfig, tag, minconfig)
        want(await divider.getConfig(tag)).eql(minconfig)
    })

    describe('poke', () => {
        const tag  = b32('hello')
        const taga = b32('feed')
        const tagb = b32('base')
        const tagc = b32('good')
        let config
        let timestamp
        beforeEach(async () => {
            config = [[ALI, BOB, CAT], [taga, tagb, tagc], [RAY, RAY, RAY]]
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
        })

        it('three opds', async () => {
            await send(divider.setConfig, tag, config)

            const timestamp = (await ethers.provider.getBlock('latest')).timestamp
            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(ray(5)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(ray(2)), timestamp + 200)

            const res = await fb.pull(divider.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(5), 32), BigNumber.from(timestamp + 100)])
        })

        it('divide by zero', async () => {
            // two from same src
            await send(divider.setConfig, tag, [[ALI, BOB, BOB], [taga, tagb, tagc], [RAY, RAY, RAY]])

            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(ray(0)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(ray(2)), timestamp + 200)

            await fail('panic', divider.read, tag)
        })

        it('minttl', async () => {
            await send(divider.setConfig, tag, [[ALI, BOB], [taga, tagb], [RAY, RAY]])
            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 97)
            await send(fb.connect(bob).push, tagb, b32(ray(20)), timestamp + 100)
            const res = await fb.pull(divider.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(2.5), 32), BigNumber.from(timestamp + 97)])
        })

        it('scales', async () => {
            config = [[ALI, BOB, CAT], [taga, tagb, tagc], [WAD, RAY, RAD]]
            await send(divider.setConfig, tag, config)

            const timestamp = (await ethers.provider.getBlock('latest')).timestamp
            await send(fb.connect(ali).push, taga, b32(wad(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(ray(5)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(rad(2)), timestamp + 200)

            let res = await fb.pull(divider.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(5), 32), BigNumber.from(timestamp + 100)])


            config = [[ALI, BOB, CAT], [taga, tagb, tagc], [RAD, RAD, RAD]]
            await send(divider.setConfig, tag, config)

            await send(fb.connect(ali).push, taga, b32(rad(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(rad(5)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(rad(2)), timestamp + 200)

            res = await fb.pull(divider.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(5), 32), BigNumber.from(timestamp + 100)])
        })

        it('wrong tag', async () => {
            // should get an error rather than returning 0 value
            await fail('panic', divider.read, b32('unset'))
        })
    })
})


