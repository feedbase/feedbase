import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { Contract } from 'hardhat/types'
import { fail, revert, snapshot, want } from 'minihat'

const debug = require('debug')('feedbase:test')
const { constants, BigNumber, utils } = ethers
const { MaxUint256 } = constants
const { formatBytes32String, parseEther, parseBytes32String } = utils

describe('medianizer', () => {
  let fb, medianizer, selector
  let ali, s1, s2, s3, s4, s5
  const fee = 5
  const amt = 1000
  const tag = formatBytes32String('MEDCASH')

  before(async () => {
    [ali, s1, s2, s3, s4, s5] = await ethers.getSigners()

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const MedianizerFactory = await ethers.getContractFactory('Medianizer')
    medianizer = await MedianizerFactory.deploy(fb.address)

    await snapshot(hh)
  })

  beforeEach(async () => {
    await revert(hh)
  })

  describe('push', () => {
    it('One value', async () => {
      const vals = [1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1]
      const selectors = sources.map(s => s.address)

      await medianizer.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1000)
    })

    it('Two values', async () => {
      const vals = [1000, 1200].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2]
      const selectors = sources.map(s => s.address)

      await medianzier.setSources(selectors);
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1100)
    })

    it('Three values', async () => {
      const vals = [1000, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3]

      await medianizer.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it('Four values', async () => {
      const vals = [1000, 1100, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4]
      const selectors = sources.map(s => s.address)

      await selector.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1150)
    })

    it('Five values', async () => {
      const vals = [1000, 1100, 1200, 1300, 1400].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4, s5]
      const selectors = sources.map(s => s.address)
      await medianizer.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it('One expired value', async () => {
      const vals = [1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 60 * 60 * 24
      const now = Math.ceil(Date.now() / 1000)
      const sources = [s1]
      const selectors = sources.map(s => s.address)
      await medianizer.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await hh.network.provider.send('evm_setNextBlockTimestamp', [
        now + 2 * ttl
      ])

      await fail("VM Exception while processing transaction: reverted with reason string 'ERR_READ'", medianizer.push, tag)
    })

    it('Two unordered values', async () => {
      const vals = [1200, 1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2]
      const selectors = sources.map(s => s.address)

      await selector.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1100)
    })

    it('Three unordered values', async () => {
      const vals = [1300, 1000, 1200].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3]
      const selectors = sources.map(s => s.address)

      await medianizer.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it('Four unordered values', async () => {
      const vals = [1200, 1000, 1300, 1100].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4]
      const selectors = sources.map(s => s.address)

      await medianizer.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1150)
    })

    it('Five unordered values', async () => {
      const vals = [1300, 1100, 1400, 1200, 1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4, s5]
      const selectors = sources.map(s => s.address)
      await medianizer.setSources(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })
  })
})
