import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { want, snapshot, revert, b32, ray } from 'minihat'
const { BigNumber } = ethers
const dpack = require('@etherpacks/dpack')

const debug = require('debug')('feedbase:test')

let fb
let signers

describe('par adapter test', () => {
  const TAG = b32("")

  let ali, bob, cat
  let ALI, BOB, CAT
  let pAdapt, vat

  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob, cat] = signers;
    [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const MockVatFactory = await ethers.getContractFactory('MockVat')
    vat = await MockVatFactory.deploy()
    await vat.deployed();

    // deploy par adapter by running deploy task and test pack works
    const pAdaptPack = await hh.run('deploy-par-adapter', { vatAddr: vat.address })
    const pAdaptDapp = await dpack.load(pAdaptPack, ethers, ali)
    pAdapt = pAdaptDapp.paradapter

    await snapshot(hh)
  })
  beforeEach(async () => {
    await revert(hh)
  })

  it('read par', async function () {
    const parVal = ray(1.1)
    vat.setPar(parVal)
    const timestamp = (await ethers.provider.getBlock('latest')).timestamp
    let [par, ttl] = await fb.pull(pAdapt.address, TAG)
    want(par).eql(ethers.utils.hexZeroPad(parVal, 32))
    want(ttl).eql(BigNumber.from(timestamp))
  })
})
