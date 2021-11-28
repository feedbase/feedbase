import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { Contract } from 'hardhat/types'
import { fail, revert, snapshot, want } from 'minihat'

const debug = require('debug')('feedbase:test')
const { constants, BigNumber, utils } = ethers
const { MaxUint256 } = constants
const { formatBytes32String, parseEther, parseBytes32String } = utils

describe('medianizer', () => {
  let cash, usdc, dai, tokens
  let fb, medianizer, tagProvider
  let selector
  let ali, bob
  const fee = 5
  const amt = 1000
  const tag = formatBytes32String('DYN_MED_CASH')
  const tags = [
    formatBytes32String('CASH'), 
    formatBytes32String('USDC'), 
    formatBytes32String('DAI')
  ]

  before(async () => {
    [ali, bob] = await ethers.getSigners()

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const DynamicTagProviderFactory = await ethers.getContractFactory('DynamicTagProvider')
    tagProvider = await DynamicTagProviderFactory.deploy()

    const MedianizerFactory = await ethers.getContractFactory('DynamicMedianizerCombinator')
    medianizer = await MedianizerFactory.deploy(tagProvider.address, fb.address)

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')
    usdc = await TokenDeployer.deploy('USDC', 'USDC')
    dai = await TokenDeployer.deploy('DAI', 'DAI')

    tokens = [cash, usdc, dai]

    for await (let token of tokens) {
      await token.mint(ali.address, 10000)
      await token.approve(fb.address, MaxUint256)
    }

    await snapshot(hh)
  })

  beforeEach(async () => {
    await revert(hh)

    for await (let token of tokens) {
      await fb.setCost(tag, token.address, fee)
      // Provide cash for combinator requests
      await fb.deposit(token.address, ali.address, amt, { value: parseEther('0.1') })
      const bal = await fb.balances(token.address, ali.address)
      want(bal.toNumber()).to.eql(amt)
    }
  })

  it('TagProvider', async function () {
    const owner = await tagProvider.owner()
    want(owner).to.eql(ali.address)
    await tagProvider.setTags(tags)
    const set = await tagProvider.getTags()
    want(set).to.eql(tags)
  })

  it('poke', async function () {
    await tagProvider.setTags(tags)

    // ali deposits amt into feedbase
    const predeposit = await fb.balances(cash.address, ali.address)
    await fb.deposit(cash.address, ali.address, amt)
    const postdeposit = await fb.balances(cash.address, ali.address)
    want(predeposit.toNumber() + amt).to.eql(postdeposit.toNumber())

    // ali requests funds transfer to medianizer
    await fb.request(medianizer.address, tag, cash.address, amt)
    const paid = await fb.requested(medianizer.address, tag, cash.address)
    want(paid.toNumber()).to.eql(amt)

    // ali's tags have not been paid for
    for await (let t of tags) {
      const req = await fb.requested(ali.address, t, cash.address)
      want(req.toNumber()).to.eql(0)
    }

    // ali deposits into feedbase for medianizer and poke makes requests for
    // all the tags.
    await fb.deposit(cash.address, medianizer.address, amt)
    await medianizer.poke(ali.address, tag, cash.address)

    for await (const t of tags) {
      const req = await fb.requested(ali.address, t, cash.address)
      want(req.toNumber()).to.eql(Math.round(amt / tags.length))
    }
  })

  describe('push', () => {
    it('One value', async () => {
      const val = utils.hexZeroPad(utils.hexValue(1000), 32)
      const ttl = 10 * 10 ** 12
      const [t1] = tags

      await tagProvider.setTags([t1])
      const con = fb.connect(ali)
      await con.push(t1, val, ttl, cash.address)
      await fb.deposit(cash.address, medianizer.address, amt)

      await medianizer.push(ali.address, tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1000)
    })

    it('Two values (different tags)', async () => {
      const vals = [1000, 1200].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const [t1, t2] = tags

      await tagProvider.setTags([t1, t2])
      const con = fb.connect(ali)
      await Promise.all([t1, t2].map(async (t, idx) => {
        await con.push(t, vals[idx], ttl, cash.address)
      }))
      await medianizer.push(ali.address, tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1100)
    })

    it.skip('Three values (different tags)', async () => {
      const vals = [1000, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3]
      const selectors = sources.map(s => s.address)
      const tags = []

      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it.skip('Four values', async () => {
      const vals = [1000, 1100, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4]
      const selectors = sources.map(s => s.address)

      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1150)
    })

    it.skip('Five values', async () => {
      const vals = [1000, 1100, 1200, 1300, 1400].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4, s5]
      const selectors = sources.map(s => s.address)
      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it.skip('One expired value', async () => {
      const vals = [1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 60 * 60 * 24
      const now = Math.ceil(Date.now() / 1000)
      const sources = [s1]
      const selectors = sources.map(s => s.address)
      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await hh.network.provider.send('evm_setNextBlockTimestamp', [
        now + 2 * ttl
      ])

      await fail("VM Exception while processing transaction: reverted with reason string 'ERR_READ'", medianizer.push, tag)
    })

    it.skip('Two unordered values', async () => {
      const vals = [1200, 1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2]
      const selectors = sources.map(s => s.address)

      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1100)
    })

    it.skip('Three unordered values', async () => {
      const vals = [1300, 1000, 1200].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3]
      const selectors = sources.map(s => s.address)

      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })

    it.skip('Four unordered values', async () => {
      const vals = [1200, 1000, 1300, 1100].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4]
      const selectors = sources.map(s => s.address)

      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1150)
    })

    it.skip('Five unordered values', async () => {
      const vals = [1300, 1100, 1400, 1200, 1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1, s2, s3, s4, s5]
      const selectors = sources.map(s => s.address)
      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })
  })
})
