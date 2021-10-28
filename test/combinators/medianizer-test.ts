import { ethers } from 'hardhat'
import { Contract } from 'hardhat/types'
import { want } from 'minihat'

const debug = require('debug')('feedbase:test')
const { constants, BigNumber, utils } = ethers
const { MaxUint256 } = constants
const { formatBytes32String, parseEther, parseBytes32String } = utils

const toAddressList = (xs: Contract[]): string[] => xs.map(x => x.address)

describe('medianizer', () => {
  let cash, sources
  let fb, medianizer, selector
  let ali, bob
  let s1, s2, s3

  const tag = formatBytes32String('MEDCASH')

  before(async () => {
    [ali, bob, s1, s2, s3] = await ethers.getSigners()

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

    sources = [s1, s2, s3]
  })

  it('basics', async function () {
    const fee = 5
    const amt = 1000

    await fb.setCost(tag, cash.address, fee)
    // Provide cash for combinator requests
    await fb.deposit(cash.address, ali.address, amt, { value: parseEther('0.1') })
    const bal = await fb.balances(cash.address, ali.address)
    want(bal.toNumber()).to.eql(amt)
  })

  it('selector', async function () {
    const owner = await selector.owner()
    want(owner).to.eql(ali.address)

    await selector.setSelectors(toAddressList(sources))
    const { set } = await selector.getSelectors()
    want(set).to.eql(toAddressList(sources))
  })

  it('poke', async function () {
    const amt = 1000
    const src = medianizer.address
    const predeposit = await fb.balances(cash.address, ali.address)
    await fb.deposit(cash.address, ali.address, amt)
    const postdeposit = await fb.balances(cash.address, ali.address)
    want(predeposit.toNumber() + amt).to.eql(postdeposit.toNumber())
    await fb.request(src, tag, cash.address, amt)
    const paid = await fb.requested(src, tag, cash.address)
    want(paid.toNumber()).to.eql(amt)
    await fb.deposit(cash.address, medianizer.address, amt)
    await medianizer.poke(tag, cash.address)
    const paidReqs = await Promise.all(sources.map(async s => await fb.requested(s.address, tag, cash.address)))
    want(paidReqs.map((x: typeof BigNumber) => x.toNumber())).to.eql([333, 333, 333])
  })

  it('push', async function () {
    const vals = [1000, 1200, 1200].map(x => formatBytes32String(`${x}`))
    const ttl = 10 * 10 ** 12
    await Promise.all(sources.map(async (src, idx) => {
      const con = fb.connect(src)
      await con.push(tag, vals[idx], ttl, cash.address)
    }))

    await medianizer.push(tag)
    const [median] = await fb.read(medianizer.address, tag)
    want(parseBytes32String(median)).to.eql('1200')
  })
})
