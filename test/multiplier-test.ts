import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, ray} from 'minihat'
const { BigNumber } = ethers

const debug = require('debug')('feedbase:test')

let fb
let signers
describe('multiplier', () => {
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let multiplier
    let minconfig
    const zeroconfig = [[], []]
    before(async () => {
      signers = await ethers.getSigners();
      [ali, bob, cat] = signers;
      [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()

      const MultiplierFactory = await ethers.getContractFactory('Multiplier')
      multiplier = await MultiplierFactory.deploy(fb.address)

      minconfig = [
            [ALI, BOB],
            [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob'))]
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
            await send(multiplier.setConfig, tag, config)

            const timestamp = (await ethers.provider.getBlock('latest')).timestamp
            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(ray(5)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(ray(2)), timestamp + 200)

            const res = await fb.pull(multiplier.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(500), 32), BigNumber.from(timestamp + 100)])
        })

        it('mul by zero', async () => {
            // two from same src
            await send(multiplier.setConfig, tag, [[ALI, BOB, CAT], [taga, tagb, tagc]])

            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 100)
            await send(fb.connect(bob).push, tagb, b32(ray(0)), timestamp + 102)
            await send(fb.connect(cat).push, tagc, b32(ray(2)), timestamp + 200)

            const res = await fb.pull(multiplier.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(0), 32), BigNumber.from(timestamp + 100)])
        })

        it('minttl', async () => {
            await send(multiplier.setConfig, tag, [[ALI, BOB], [taga, tagb]])
            await send(fb.connect(ali).push, taga, b32(ray(50)), timestamp + 97)
            await send(fb.connect(bob).push, tagb, b32(ray(20)), timestamp + 100)
            const res = await fb.pull(multiplier.address, tag)
            want(res).eql([ethers.utils.hexZeroPad(ray(1000), 32), BigNumber.from(timestamp + 97)])
        })

        it('wrong tag', async () => {
            // should get an error rather than returning 0 value
            await fail('panic', multiplier.read, b32('unset'))
        })
    })
})


