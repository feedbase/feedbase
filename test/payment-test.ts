import Feedbase from '../artifacts/contracts/Feedbase.sol/Feedbase.json'
import BasicReceiverFactory from '../artifacts/contracts/Receiver.sol/BasicReceiverFactory.json'
import BasicReceiver from '../artifacts/contracts/Receiver.sol/BasicReceiver.json'

import Token from '../artifacts/contracts/erc20/MockToken.sol/MockToken.json'

import { ethers, network } from 'hardhat'
import { send, want } from 'minihat'

const debug = require('debug')('feedbase:test')

let fb
let cash
let signers

const TAG      = Buffer.from('USDETH' + ' '.repeat(26))
const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')


const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  cash = cash.connect(signer)
  fb = fb.connect(signer)
}

describe('pay flow', () => {
  let ALI, BOB;
  beforeEach(async () => {
    signers = await ethers.getSigners()
    ALI = signers[0].address;
    BOB = signers[1].address;

    const FeedbaseDeployer = await ethers.getContractFactory('Feedbase')
    const TokenDeployer = await ethers.getContractFactory('MockToken')
    fb = await FeedbaseDeployer.deploy()
    cash = await TokenDeployer.deploy('Mock Cash', 'CASH')

    use(1) // bob

    await send(cash.mint, BOB, 1000)
    await send(cash.approve, fb.address, 1000000)

    use(0) // ali

    await send(fb.setCost, TAG, cash.address, 100)
  })

  it('deposit request push', async () => {
    use(1) // bob

    const bal = await cash.balanceOf(BOB)
    want(bal.toNumber()).equals(1000)

    await send(fb.deposit, cash.address, BOB, 500)

    const fbal0 = await fb.balances(cash.address, BOB)
    want(fbal0.toNumber()).equals(500)
    debug(`fbal0 ${fbal0}`)
    const bal2 = await cash.balanceOf(BOB)
    want(bal2.toNumber()).equals(500)

    await send(fb.request, ALI, TAG, cash.address, 100, 0)

    const fbal1 = await fb.balances(cash.address, BOB);
    want(fbal1.toNumber()).equals(400)
    const fbal2 = await fb.requested(ALI, TAG, cash.address, 0)
    want(fbal2.toNumber()).equals(100)

    use(0)

    const seq = 1
    const sec = Math.floor(Date.now() / 1000)
    const ttl = 10 ** 10
    const val = Buffer.from('ff'.repeat(32), 'hex')

    await send(fb.push, TAG, val, ttl, cash.address, 0)

    const fbal3 = await fb.requested(ALI, TAG, cash.address, 0)
    want(fbal3.toNumber()).equals(0)

    const pre = await cash.balanceOf(ALI)
    await send(fb.withdraw, cash.address, ALI, 100)
    const post = await cash.balanceOf(ALI)
    want(post.sub(pre).toNumber()).equals(100)
  })
})
