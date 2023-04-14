import { constants } from 'buffer'
import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, revert, snapshot, want } from 'minihat'

const debug = require('debug')('feedbase:test')
const { BigNumber, utils } = ethers
const { formatBytes32String, hexZeroPad, hexValue } = utils

describe('medianizer', () => {
  let fb, medianizer
  let ali, s1, s2, s3, s4, s5
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

  describe('poke', () => {
    describe('expired src feeds', async () => {
        let timestamp
        let srcaddrs
        let tags
        beforeEach(async () => {
            srcaddrs = [s1.address, s2.address]
            tags = [tag, tag]
            await send(medianizer.setConfig, tag, [srcaddrs, tags, 1])
            timestamp = (await ethers.provider.getBlock('latest')).timestamp
            await send(fb.connect(s1).push, tag, hexZeroPad(hexValue(1000), 32), timestamp + 1000)
            await send(fb.connect(s2).push, tag, hexZeroPad(hexValue(2000), 32), timestamp + 2000)
        })

        it("srcs length and tags length not equal", async () => {
            await fail('ErrConfig', medianizer.setConfig, tag, [[s1.address, s2.address], [tag], 1])
            await fail('ErrConfig', medianizer.setConfig, tag, [[s1.address], [tag, tag], 1])
            await fail('ErrConfig', medianizer.setConfig, tag, [[s1.address], [], 1])
            await fail('ErrConfig', medianizer.setConfig, tag, [[], [tag], 1])
        })

        it('stale src feed', async () => {
            debug('both vals live')
            await hh.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [timestamp + 1000]
            });
            await send(medianizer.poke, tag)
            let res = await fb.pull(medianizer.address, tag)
            want(Number(res.val)).to.eql(1500)

            debug('second val live')
            await hh.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [timestamp + 2000]
            });
            await send(medianizer.poke, tag)
            res = await fb.pull(medianizer.address, tag)
            want(Number(res.val)).to.eql(2000)

            debug('no vals live')
            await fail('ErrQuorum', medianizer.poke, tag)
        })

        it('quorum', async () => {
            await send(medianizer.setConfig, tag, [srcaddrs, tags, 3])
            await fail('ErrQuorum', medianizer.poke, tag)

            await send(medianizer.setConfig, tag, [srcaddrs, tags, 2])
            await hh.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [timestamp + 1000]
            });

            await send(medianizer.poke, tag)
            await fail('ErrQuorum', medianizer.poke, tag)
            await send(medianizer.setConfig, tag, [srcaddrs, tags, 1])
            await send(medianizer.poke, tag)
            await send(medianizer.poke, tag)

            await hh.network.provider.request({
                method: "evm_setNextBlockTimestamp",
                params: [timestamp + 2000]
            });
            await send(medianizer.poke, tag)
            await fail('ErrQuorum', medianizer.poke, tag) // err order
        })
    })

    it('One value', async () => {
      const vals = [1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)

      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      want(await fb.reads(medianizer.address, tag)).true
      await medianizer.poke(tag)
      want(await fb.reads(medianizer.address, tag)).false
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1000)
    })

    it('Two values', async () => {
      const vals = [1000, 1200].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1100)
    })

    it('Three values', async () => {
      const vals = [1000, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it('Four values', async () => {
      const vals = [1000, 1100, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1150)
    })

    it('Five values', async () => {
      const vals = [1000, 1100, 1200, 1300, 1400].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4, s5]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    //   /*
    // it('One expired value', async () => {
    //   const vals = [1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
    //   const ttl = 60 * 60 * 24
    //   const now = Math.ceil(Date.now() / 1000)
    //   const sources = [s1]
    //   const selectors = sources.map(s => s.address)
    //   await medianizer.setSources(selectors)
    //   await Promise.all(sources.map(async (src, idx) => {
    //     const con = fb.connect(src)
    //     await con.push(tag, vals[idx], ttl)
    //   }))

    //   await hh.network.provider.send('evm_setNextBlockTimestamp', [
    //     now + 2 * ttl
    //   ])

    //   await fail("VM Exception while processing transaction: reverted with reason string 'ERR_READ'", medianizer.push, tag)
    // })
    // */

    it('Two unordered values', async () => {
      const vals = [1200, 1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1100)
    })

    it('Three unordered values', async () => {
      const vals = [1300, 1000, 1200].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it('Four unordered values', async () => {
      const vals = [1200, 1000, 1300, 1100].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1150)
    })

    it('Five unordered values', async () => {
      const vals = [1300, 1100, 1400, 1200, 1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4, s5]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(tag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(tag)
      const [median] = await fb.pull(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it('Alternate target tag', async () => {
      const newTag = Buffer.from('OTHERTAG'.padStart(32, '\0'))
      const vals = [1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1]
      const srcaddrs = sources.map(s => s.address)
      const tags = Array(srcaddrs.length).fill(tag)
      
      await medianizer.setConfig(newTag, [srcaddrs, tags, 0])

      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl)
      }))

      await medianizer.poke(newTag)
      const [median] = await fb.pull(medianizer.address, newTag)
      want(BigNumber.from(median).toNumber()).to.eql(1000)
    })
  })
})
