import Feedbase from '../artifacts/contracts/Feedbase.sol/Feedbase.json'
import BasicReceiverFactory from '../artifacts/contracts/Receiver.sol/BasicReceiverFactory.json'
import BasicReceiver from '../artifacts/contracts/Receiver.sol/BasicReceiver.json'

import Token from '../artifacts/contracts/erc20/MockToken.sol/MockToken.json'

import { ethers, network } from 'hardhat'

const debug = require('debug')('feedbase:test')
const want = require('chai').expect

let fb
let cash
let signers

const TAG = Buffer.from('USDETH' + ' '.repeat(26))

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  cash = cash.connect(signer)
  fb = fb.connect(signer)
}

describe('pay flow', () => {
  beforeEach(async () => {
    signers = await ethers.getSigners()

    const FeedbaseDeployer = await ethers.getContractFactory('Feedbase')
    const TokenDeployer = await ethers.getContractFactory('MockToken')
    fb = await FeedbaseDeployer.deploy()
    cash = await TokenDeployer.deploy('CASH')

    use(1)

    const tx_mint = await cash.functions['mint(uint256)'](1000)
    await tx_mint.wait()
    const tx_approve = await cash.functions['approve(address)'](fb.address)
    await tx_approve.wait()

    use(0)

    const tx_setCost = await fb.setCost(TAG, cash.address, 100)
    await tx_setCost.wait()
  })

  it('deposit request push', async () => {
    use(1)

    const bal = await cash.balanceOf(signers[1].address)
    want(bal.toNumber()).equals(1000)

    const tx_topUp = await fb.deposit(cash.address, 500)
    await tx_topUp.wait()

    const fbal0 = await fb.balances(cash.address, signers[1].address)
    want(fbal0.toNumber()).equals(500)
    debug(`fbal0 ${fbal0}`)
    const bal2 = await cash.balanceOf(signers[1].address)
    want(bal2.toNumber()).equals(500)

    const tx_request = await fb.request(signers[0].address, TAG, cash.address, 100)
    await tx_request.wait()

    const fbal1 = await fb.balances(cash.address, signers[1].address)
    want(fbal1.toNumber()).equals(400)
    const fbal2 = await fb.requested(signers[0].address, TAG, cash.address)
    want(fbal2.toNumber()).equals(100)

    use(0)

    const seq = 1
    const sec = Math.floor(Date.now() / 1000)
    const ttl = 10 ** 10
    const val = Buffer.from('ff'.repeat(32), 'hex')

    const tx_push = await fb.push(TAG, val, ttl, cash.address)
    await tx_push.wait()

    const fbal3 = await fb.requested(signers[0].address, TAG, cash.address)
    want(fbal3.toNumber()).equals(0)

    const pre = await cash.balanceOf(signers[0].address)
    const tx_cashOut = await fb.withdraw(cash.address, 100)
    await tx_cashOut.wait()
    const post = await cash.balanceOf(signers[0].address)
    want(post.sub(pre).toNumber()).equals(100)
  })
})
