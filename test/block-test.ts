import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, ray} from 'minihat'
const { BigNumber } = ethers

const debug = require('debug')('feedbase:test')

let fb
let signers
describe('block', () => {
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let block
    let minconfig
    const zeroconfig = [[], []]
    before(async () => {
      signers = await ethers.getSigners();
      [ali, bob, cat] = signers;
      [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()

      const MultiplierFactory = await ethers.getContractFactory('Multiplier')
      block = await MultiplierFactory.deploy(fb.address)

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

    it('getConfig', async () => {
        let config = [
            [ali.address, bob.address],
            [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob'))]
        ]
        await send(block.setConfig, b32('hello'), config)
        want(await block.getConfig(b32('hello'))).eql(config)
    })

    it('ward setConfig', async function () {
        await fail('ErrWard', block.connect(bob).setConfig, b32('hello'), minconfig)
        await send(block.ward, BOB, true);
        await send(block.connect(bob).setConfig, b32('hello'), minconfig)
        await send(block.ward, BOB, false)
        await fail('ErrWard', block.connect(bob).setConfig, b32('hello'), minconfig)
    })

    it('setConfig', async function () {
        want(await block.getConfig(tag)).eql(zeroconfig)

        let config = [[CAT], ['0x'+b32('hello').toString('hex')]]
        await fail('ErrShort', block.setConfig, tag, config)

        config = [[ALI, BOB, CAT],
                  [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob'))]]
        await fail('ErrMatch', block.setConfig, tag, config)

        config = [[ALI, BOB],
                  [ethers.utils.hexlify(b32('ali')), ethers.utils.hexlify(b32('bob')), ethers.utils.hexlify(b32('cat'))]]
        await fail('ErrMatch', block.setConfig, tag, config)

        await send(block.setConfig, tag, minconfig)
        want(await block.getConfig(tag)).eql(minconfig)
    })
})
