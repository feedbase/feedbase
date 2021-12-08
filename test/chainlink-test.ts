import { makeUpdateDigest } from '../src'
import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
const { constants, BigNumber, utils } = ethers
import { send, fail, chai, want, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')
const { hexZeroPad, hexlify, hexValue } = ethers.utils
const { AddressZero, HashZero } = ethers.constants

let link
let cash
let fb
let signers
let oracle
let adapter
let rec
let selector
let medianizer

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  if( link ) link = link.connect(signer)
  if( cash ) cash = cash.connect(signer)
  if( fb ) fb = fb.connect(signer)
  if( oracle ) oracle = oracle.connect(signer)
  if( adapter ) adapter = adapter.connect(signer)
  if( rec ) rec = rec.connect(signer)
  if( selector ) selector = selector.connect(signer)
  if( medianizer ) medianizer = medianizer.connect(signer)
}

let fulfill = async (x) => {
  const logs    = await oracle.filters.OracleRequest(null)
  const _logs   = await oracle.queryFilter(logs, 0)
  want(_logs.length).above(0)

  const args    = _logs[_logs.length - 1].args
  const requestId = Buffer.from(args.requestId.slice(2), 'hex')
  debug('requestId => ', requestId)
  await oracle.fulfillOracleRequest(requestId, x)
}

describe('chainlink', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  const decimals = 18
  const initialAnswer = 0
  let tag, seq, sec, ttl, val
  let ali, bob
  let ALI, BOB
  let cash

  before(async () => {
    signers = await ethers.getSigners()

    ;[ali, bob] = signers
    ;[ALI, BOB] = [ali.address, bob.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const LinkDeployer = await ethers.getContractFactory('MockLink')
    link = await LinkDeployer.deploy()

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')

    const AdapterDeployer = await ethers.getContractFactory('ChainlinkAdapter')
    adapter = await AdapterDeployer.deploy(link.address, fb.address)

    const OracleDeployer = await ethers.getContractFactory('MockOracle')
    oracle = await OracleDeployer.deploy(link.address)

    const rec_type = await ethers.getContractFactory('BasicReceiver')
    rec = await rec_type.deploy(fb.address)

    const FixedSelectorProviderFactory = await ethers.getContractFactory(
      'FixedSelectorProvider'
    )
    selector = await FixedSelectorProviderFactory.deploy()

    const MedianizerFactory = await ethers.getContractFactory(
      'MedianizerCombinator'
    )
    medianizer = await MedianizerFactory.deploy(selector.address, fb.address)

    use(0)

    await send(cash.mint, ALI, 1000)
    await send(cash.approve, adapter.address, UINT_MAX)
    await send(link.approve, adapter.address, UINT_MAX)

    await snapshot(hh)
  })

  let amt, specId
  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from(link.address.slice(2).padStart(64, '0'), 'hex')
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
    amt = 10
    specId = Buffer.from('ff'.repeat(32), 'hex')
    use(0)
  })

  describe('setup', () => {

    describe('deposit', () => {
      let bal
      beforeEach(async () => {
        bal = 1000
      })

      it('success', async function () {
        want((await adapter.balances(link.address, ALI)).toNumber()).to.eql(0)
        await send(adapter.deposit, link.address, BOB, bal)
        want((await adapter.balances(link.address, BOB)).toNumber()).to.eql(bal)
      })

      // TODO transferFrom return value tests
      it('erc20 transfer fail', async function () {
        await send(link.transfer, BOB, bal)
        use(1)
        await fail('', adapter.deposit, link.address, BOB, bal+1)
      })
    })

    describe('withdraw', () => {
      let bal, prev
      beforeEach(async () => {
        bal = 1000
        prev = await link.balanceOf(ALI)
      })

      it('withdraw', async function () {
        await send(adapter.deposit, link.address, ALI, bal)
        await send(adapter.withdraw, link.address, ALI, bal)
        const aliBalance = (await adapter.balances(link.address, ALI)).toNumber()
        want(aliBalance).to.eql(0)
      })

      it('withdraw to other user', async function () {
        await send(adapter.deposit, link.address, ALI, bal)
        await send(adapter.withdraw, link.address, BOB, bal)
        const aliBalance = (await adapter.balances(link.address, ALI)).toNumber()
        const bobBalance = (await link.balanceOf(BOB)).toNumber()
        want(aliBalance).to.eql(0)
        want(bobBalance).to.eql(bal)
      })

      it('withdraw underflow', async function () {
        await send(adapter.deposit, link.address, ALI, bal)
        await fail('underflow', adapter.withdraw, link.address, BOB, bal+1)
      })
    })

    describe('checkTag', () => {
      it('sets tag on setCost', async () => {
        const cost = 5
        const before = await adapter.tags(oracle.address, specId)
        await send(adapter.setCost, oracle.address, specId, link.address, cost)
        const after = await adapter.tags(oracle.address, specId)
        want(before.toString()).to.eql(HashZero)
        want(after.toString()).to.eql(hexZeroPad(hexValue(1), 32))
      })

      it.skip('sets tag on request', async () => {})
    })

    describe('get/setCost', () => {
      const cost = 7
      
      it('initialized', async () => {
        const before = (await adapter.getCost(oracle.address, specId, link.address)).toNumber()
        want(before).to.equal(0)
      })

      it('setCost', async () => {
        const { status } = await send(adapter.setCost, oracle.address, specId, link.address, cost)
        want(status).to.eql(1)
      })

      it('getCost', async () => {
        await send(adapter.setCost, oracle.address, specId, link.address, cost)
        const after = (await adapter.getCost(oracle.address, specId, link.address)).toNumber()
        want(after).to.equal(cost)
      })

      it('setCost not owner', async () => {
        const con = adapter.connect(bob)
        await fail('setCost: permission denied', con.setCost, oracle.address, specId, link.address, cost)
      })

      it('setCost oracle is zero address', async () => {
        await fail('ERR_INV_ORACLE', adapter.setCost, AddressZero, specId, link.address, cost)
      })

      it('setCost specId is zero hash', async () => {
        await fail('ERR_INV_SPECID', adapter.setCost, oracle.address, HashZero, link.address, cost)
      })

      it('setCost cash is zero address', async () => {
        await fail('can only setCost link', adapter.setCost, oracle.address, specId, AddressZero, cost)
      })

      it('setCost cash is not LINK token address', async () => {
        await fail('can only setCost link', adapter.setCost, oracle.address, specId, cash.address, cost)
      })
    })

    describe('requested', () => {
      const n_deposit = 10
      const n_requests = 3
      beforeEach(async () => {
        await send(adapter.setCost, oracle.address, specId, link.address, amt)
        // check balance of user before
        const aliBalanceBefore = await adapter.balances(link.address, ALI)
        const adapterBalanceBefore = await fb.balances(link.address, adapter.address)
        const adapterPaidBefore = await adapter.requested(oracle.address, specId, link.address)
        want(aliBalanceBefore.toNumber()).to.eql(0)
        want(adapterBalanceBefore.toNumber()).to.eql(0)
        want(adapterPaidBefore.toNumber()).to.eql(0)

        // deposit
        await send(adapter.deposit, link.address, ALI, amt * n_deposit)

        const aliBalanceMiddle = await adapter.balances(link.address, ALI)
        const adapterBalanceMiddle = await fb.balances(link.address, adapter.address)
        const adapterPaidMiddle = await adapter.requested(oracle.address, specId, link.address)
        want(aliBalanceMiddle.toNumber()).to.eql(amt * n_deposit)
        want(adapterBalanceMiddle.toNumber()).to.eql(amt * n_deposit)
        want(adapterPaidMiddle.toNumber()).to.eql(0)

        // request
        await send(adapter.request, oracle.address, specId, link.address, amt * n_requests)

        // check balance of user after
        const aliBalanceAfter = await adapter.balances(link.address, ALI)
        const adapterBalanceAfter = await fb.balances(link.address, adapter.address)
        const adapterPaidAfter = await adapter.requested(oracle.address, specId, link.address)
        want(aliBalanceAfter.toNumber()).to.eql(amt * (n_deposit - n_requests))
        want(adapterBalanceAfter.toNumber()).to.eql(amt * (n_deposit - n_requests))
        want(adapterPaidAfter.toNumber()).to.eql(amt * (n_requests - 1))
      })

      it('not found', async function () {
        await fail(
          'invalid oracle,specId pair',
          adapter.requested,
          oracle.address,
          Buffer.from('00'.repeat(32), 'hex'),
          link.address
        )
        await fail(
          'invalid oracle,specId pair',
          adapter.requested,
          cash.address,
          specId,
          link.address
        )
        await fail(
          'invalid oracle,specId pair',
          adapter.requested,
          cash.address,
          Buffer.from('00'.repeat(32), 'hex'),
          link.address
        )
      })

      it('found', async function () {
        const requested = await adapter.requested(oracle.address, specId, link.address)
        want(requested.toNumber()).to.equal(amt * (3 -1))
      })
    })
  })

  it('read', async function () {
    await fail('read: invalid oracle,specId', adapter.read, oracle.address, specId)

    await send(adapter.setCost, oracle.address, specId, link.address, amt)
    // check balance of user before
    const bal = await adapter.balances(link.address, ALI)
    debug('balance before: ', bal.toString())

    await send(adapter.deposit, link.address, ALI, amt)
    await send(adapter.request, oracle.address, specId, link.address, amt)

    // pending
    await fail('ERR_READ', adapter.read, oracle.address, specId)

    // check balance of user after
    const after = await adapter.balances(link.address, ALI)
    debug('balance after: ', after.toString())

    await fulfill(val)

    let res = await adapter.read(oracle.address, specId)
    want(res.val.slice(2)).equal(val.toString('hex'))

    await send(adapter.deposit, link.address, ALI, amt)
    await send(adapter.request, oracle.address, specId, link.address, amt)

    // pending
    res = await adapter.read(oracle.address, specId)
    want(res.val.slice(2)).equal(val.toString('hex'))

    const newVal = Buffer.from('44'.repeat(32), 'hex')
    await fulfill(newVal)
    res = await adapter.read(oracle.address, specId)
    want(res.val.slice(2)).equal(newVal.toString('hex'))
  })

  describe('all', () => {
    it('receiver adapter direct', async function () {

      const vals = [1200, 1000, 1300].map(
        x => utils.hexZeroPad(utils.hexValue(x), 32)
      )
      const ttl = 10 * 10 ** 12
      const sources = [bob, rec, oracle]
      const selectors = sources.map(s => s.address)
      const readers = [fb.address, fb.address, adapter.address]

      debug('selectors')
      await selector.setSelectors(selectors, readers)

      debug('set costs')
      await send(adapter.setCost, oracle.address, specId, link.address, amt);
      await send(rec.setCost, tag, link.address, amt);
      await send(fb.connect(bob).setCost, tag, link.address, amt)
      const _tag = await adapter.tags(oracle.address, specId)
      debug(`_tag => ${hexlify(_tag)}`)
      const adapter_cost = await fb.getCost(adapter.address, _tag, link.address)
      debug(`adapter cost => ${adapter_cost}`)
      const bob_cost = await fb.getCost(BOB, tag, link.address)
      debug(`bob cost => ${bob_cost}`)

      debug('ali deposit into fb...')
      await send(link.approve, fb.address, amt*3)
      await send(fb.deposit, link.address, ALI, amt*3)

      debug('requesting...')
      await send(fb.request, medianizer.address, tag, link.address, amt*3)
      await send(link.approve, adapter.address, amt)
      await send(adapter.deposit, link.address, medianizer.address, amt)
      
      const m_bal_before = await fb.requested(medianizer.address, tag, link.address)
      debug(`medianizer paid => ${m_bal_before}`)
      
      debug('poke...')
      await send(medianizer.poke, tag, link.address)

      const m_bal_after = await fb.requested(medianizer.address, tag, link.address)
      debug(`medianizer paid => ${m_bal_after}`)

      const ali_paid = await fb.requested(ALI, tag, link.address)
      debug(`ali paid => ${ali_paid}`)

      const bob_paid = await fb.requested(BOB, tag, link.address)
      debug(`bob paid => ${bob_paid}`)

      const rec_paid = await fb.requested(rec.address, tag, link.address)
      debug(`rec paid => ${rec_paid}`)

      const adapter_paid = await adapter.requested(oracle.address, specId, link.address)
      debug(`adapter paid => ${adapter_paid}`)

      // Bob is signer
      use(1)

      debug('pushing...')
      await Promise.all([
        async () => {
          await fb.push(tag, vals[0], ttl, link.address)
          const [val] = await fb.read(BOB, tag)
          debug(`direct feed done => ${val}`)
        },
        async () => {
          const valBuf = Buffer.from(vals[1].slice(2), 'hex')
          const digest = makeUpdateDigest({
            tag,
            val: valBuf,
            seq: seq,
            sec: sec,
            ttl: ttl,
            chainId: hh.network.config.chainId,
            receiver: rec.address
          })
          const signature = await bob.signMessage(digest)
          const sig = ethers.utils.splitSignature(signature)
          await send(rec.connect(ali).setSigner, BOB, ttl)
          await send(
            rec.submit,
            tag,
            seq,
            sec,
            ttl,
            valBuf,
            link.address,
            sig.v, sig.r, sig.s
          )
          const [val] = await fb.read(rec.address, tag)
          debug(`receiver submit done => ${val}`)
        },
        async () => {
          await fulfill(vals[2])
          // const _tag = await adapter.tags(oracle.address, specId)
          // const [val] = await fb.read(adapter.address, _tag)
          const [val] = await adapter.read(oracle.address, tag)
          debug(`oracle fulfillment done => ${val}`)
        }
      ].map(x => x()))
    
      debug(`medianizer push(${hexlify(tag)})`)
      await medianizer.push(tag)
      debug('read from medianizer')
      const [median] = await fb.read(medianizer.address, tag)
      debug(`median => `, median)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    })
  })
})
