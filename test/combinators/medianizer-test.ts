import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { Contract } from 'hardhat/types'
import { fail, revert, snapshot, want } from 'minihat'

const debug = require('debug')('feedbase:test')
const { constants, BigNumber, utils } = ethers
const { MaxUint256 } = constants
const { formatBytes32String, parseEther, parseBytes32String } = utils

describe('medianizer', () => {
  let cash
  let fb, medianizer, selector
  let ali, s1, s2, s3, s4, s5
  const fee = 5
  const amt = 1000
  const tag = formatBytes32String('MEDCASH')

  before(async () => {
    [ali, s1, s2, s3, s4, s5] = await ethers.getSigners()

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const FixedSelectorProviderFactory = await ethers.getContractFactory('FixedSelectorProvider')
    selector = await FixedSelectorProviderFactory.deploy()

    const MedianizerFactory = await ethers.getContractFactory('MedianizerCombinator')
    medianizer = await MedianizerFactory.deploy(selector.address, fb.address)

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')

    await cash.mint(ali.address, 10000)
    await cash.approve(fb.address, MaxUint256)

    await snapshot(hh)
  })

  beforeEach(async () => {
    await revert(hh)

    await fb.setCost(tag, cash.address, fee)
    // Provide cash for combinator requests
    await fb.deposit(cash.address, ali.address, amt, { value: parseEther('0.1') })
    const bal = await fb.balances(cash.address, ali.address)
    want(bal.toNumber()).to.eql(amt)
  })

  it('selector', async function () {
    const owner = await selector.owner()
    want(owner).to.eql(ali.address)
    const sources = [s1, s2, s3]
    const selectors = sources.map(s => s.address)
    await selector.setSelectors(selectors)
    const { set } = await selector.getSelectors()
    want(set).to.eql(selectors)
  })

  it('poke', async function () {
    const src = medianizer.address
    const predeposit = await fb.balances(cash.address, ali.address)
    await fb.deposit(cash.address, ali.address, amt)
    const postdeposit = await fb.balances(cash.address, ali.address)
    want(predeposit.toNumber() + amt).to.eql(postdeposit.toNumber())

    await fb.request(src, tag, cash.address, amt)
    const paid = await fb.requested(src, tag, cash.address)
    want(paid.toNumber()).to.eql(amt)

    const sources = [s1, s2, s3]
    const selectors = sources.map(s => s.address)
    await selector.setSelectors(selectors)
    await fb.deposit(cash.address, medianizer.address, amt)
    await medianizer.poke(tag, cash.address)
    const paidReqs = await Promise.all(sources.map(async s => await fb.requested(s.address, tag, cash.address)))
    want(paidReqs.map((x: typeof BigNumber) => x.toNumber())).to.eql([333, 333, 333])
  })

  describe('push', () => {
    it('One value', async () => {
      const vals = [1000].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [s1]
      const selectors = sources.map(s => s.address)

      await selector.setSelectors(selectors)
      await Promise.all(sources.map(async (src, idx) => {
        const con = fb.connect(src)
        await con.push(tag, vals[idx], ttl, cash.address)
      }))
      await fb.deposit(cash.address, medianizer.address, amt)

      await medianizer.push(tag)
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1000)
    })

    it('Two values', async () => {
      const vals = [1000, 1200].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
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

    it('Three values', async () => {
      const vals = [1000, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
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

    it('Four values', async () => {
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

    it('Five values', async () => {
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

    it('One expired value', async () => {
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

    it('Two unordered values', async () => {
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
  })
})
