import Feedbase from '../artifacts/contracts/Feedbase.sol/Feedbase.json'
import Token from '../artifacts/contracts/erc20/MockToken.sol/MockToken.json'
import { ethers } from 'hardhat'
import { Contract } from 'hardhat/types'
import { want } from 'minihat'

const debug = require('debug')('feedbase:test')
const { constants, BigNumber, utils } = ethers
const { MaxUint256 } = constants
const { formatBytes32String, parseEther } = utils

const toAddressList = (xs: Contract[]): string[] => xs.map(x => x.address)

describe('medianizer', () => {
  let cash, sources
  let feedbase, medianizer, selector
  let ali, bob
  let s1, s2, s3

  const tag = formatBytes32String('MEDCASH')

  before(async () => {
    [ali, bob] = await ethers.getSigners()

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    feedbase = await FeedbaseFactory.deploy()

    const FixedSelectorProviderFactory = await ethers.getContractFactory('FixedSelectorProvider')
    selector = await FixedSelectorProviderFactory.deploy()

    const MedianizerFactory = await ethers.getContractFactory('MedianizerCombinator')
    medianizer = await MedianizerFactory.deploy(selector.address, feedbase.address)

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')

    await cash.mint(ali.address, 10000)
    await cash.approve(feedbase.address, MaxUint256)

    const aliCash = await cash.balanceOf(ali.address)

    s1 = await TokenDeployer.deploy('SRC1', 'SRC1')
    s2 = await TokenDeployer.deploy('SRC2', 'SRC2')
    s3 = await TokenDeployer.deploy('SRC3', 'SRC3')
    sources = [s1, s2, s3]

    debug(`feedbase deployed at: ${feedbase.address}`)
    debug(`selector deployed at: ${selector.address}`)
    debug(`medianizer deployed at: ${medianizer.address}`)
    debug(`cash deployed at: ${cash.address}`)
    debug(`ali: ${ali.address}`)
    debug(`ali cash: ${aliCash}`)
    debug(`s1: ${s1.address}`)
  })

  it('basics', async function () {
    const fee = 5
    const amt = 1000

    await feedbase.setCost(tag, cash.address, fee)
    // Provide cash for combinator requests
    await feedbase.deposit(cash.address, ali.address, amt, { value: parseEther('0.1') })
    const after = await cash.balanceOf(feedbase.address)
    debug(`cash bal after: ${after}`)
    const bal = await feedbase.balances(cash.address, ali.address)
    const medianizerCash = await feedbase.balances(cash.address, medianizer.address)
    want(bal.toNumber()).to.eql(amt)
    debug(`ali cash bal: ${bal}`)
    debug(`medianizer cash bal: ${medianizerCash}`)
  })

  it('selector', async function () {
    const owner = await selector.owner()
    want(owner).to.eql(ali.address)

    await selector.setSelectors(toAddressList(sources))
    const { set } = await selector.getSelectors()
    want(set).to.eql(toAddressList(sources))
    debug('sources: ', set)
  })

  it('poke', async function () {
    const amt = 1000
    const src = medianizer.address
    const predeposit = await feedbase.balances(cash.address, ali.address)
    await feedbase.deposit(cash.address, ali.address, amt)
    const postdeposit = await feedbase.balances(cash.address, ali.address)
    want(predeposit.toNumber() + amt).to.eql(postdeposit.toNumber())
    await feedbase.request(src, tag, cash.address, amt)
    const paid = await feedbase.requested(src, tag, cash.address)
    want(paid.toNumber()).to.eql(amt)
    await feedbase.deposit(cash.address, medianizer.address, amt)
    await medianizer.poke(tag, cash.address)
    const paidReqs = await Promise.all(sources.map(async s => await feedbase.requested(s.address, tag, cash.address)))
    want(paidReqs.map((x: typeof BigNumber) => x.toNumber())).to.eql([333, 333, 333])
  })

  it('push', async function () {
    const vals = [11, 12, 12]
    const ttl = 10 * 10 ** 12
    // sources.map(async (s, idx) => {
    //   await feedbase.push(tag, vals[idx], ttl, cash.address)
    // })
  })
})
