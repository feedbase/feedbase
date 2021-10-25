import Feedbase from '../artifacts/contracts/Feedbase.sol/Feedbase.json'
import BasicReceiverFactory from '../artifacts/contracts/Receiver.sol/BasicReceiverFactory.json'
import BasicReceiver from '../artifacts/contracts/Receiver.sol/BasicReceiver.json'

import Token from '../artifacts/contracts/erc20/MockToken.sol/MockToken.json'

import { ethers, network } from 'hardhat'

import { makeUpdateDigest } from '../src'

const debug = require('debug')('feedbase:test')
const chai = require('chai')
const want = chai.expect
chai.use(require('chai-as-promised'))

async function send(...args) {
  const f = args[0];
  const fargs = args.slice(1);
  const tx = await f(...fargs);
  return await tx.wait()
}

async function fail(...args) {
  const err = args[0];
  const sargs = args.slice(1);
  await want(send(...sargs)).rejectedWith(err);
}

let cash
let fb
let signers

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  cash = cash.connect(signer)
  fb = fb.connect(signer)
}

const { send } = require('/Users/code/hhs');

describe('feedbase', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  let tag, seq, sec, ttl, val;
  beforeEach(async () => {
    signers = await ethers.getSigners();

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()
 
    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')

    use(0)

    const tx_mint = await cash.functions['mint(address,uint256)'](signers[0].address, 1000)
    await tx_mint.wait()
    const tx_approve = await cash.functions['approve(address,uint256)'](fb.address, UINT_MAX)
    await tx_approve.wait()

    tag = Buffer.from('USDCASH'.padStart(32, '\0'))
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
    debug(tag, seq, sec, ttl, val)
  })
             
  it('basics', async function () {})

  it('oracle relay', async function () {
    const { chainId } = network.config
    debug('chainId: ', chainId)

    // debug(signers[0])
    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()
    const BasicReceiverFactoryFactory = await ethers.getContractFactory('BasicReceiverFactory')
    const factory = await BasicReceiverFactoryFactory.deploy(fb.address)

    const res = await send(factory.build);
    const oracleAddr = res.events[0].args[0]

    const oracle = await new ethers.Contract(oracleAddr, BasicReceiver.abi, signers[0])
    await send(oracle.setSigner, signers[0].address, 1000000000000)

    const sttl = await oracle.signerTTL(signers[0].address)
    debug(`sttl: ${sttl}`)

    const oracleChainId = await oracle.chainId()
    debug(`chainId: ${chainId}, type ${typeof (chainId)}`)
    debug(`oracleChainId: ${oracleChainId}, type ${typeof (oracleChainId)}`)
    want(chainId).equal(oracleChainId.toNumber())

    const digest = makeUpdateDigest({
      tag,
      val: val,
      seq: seq,
      sec: sec,
      ttl: ttl,
      chainId: chainId,
      receiver: oracle.address
    })
    debug(`digest: ${Buffer.from(digest).toString('hex')}`)

    const signature = await signers[0].signMessage(digest)
    debug(`signature ${signature}`)
    const sig = ethers.utils.splitSignature(signature)
    // debug(sig);
    await send(oracle.submit, tag, seq, sec, ttl, val, '0'.repeat(40), sig.v, sig.r, sig.s)
  })

  it('ttl on read', async function () {
    // debug(signers[0]);

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()

    const tag = Buffer.from('USDETH'.padStart(32, '\0'))
    const seq = 1
    const sec = Math.floor(Date.now() / 1000)
    const ttl = 10000000000000
    const val = Buffer.from('11'.repeat(32), 'hex')
    debug(tag, seq, sec, ttl, val)

    const push = await send(fb.push, tag, val, ttl, '00'.repeat(20))
    const read = await fb.read(signers[0].address, tag)
    debug(`read result ${read}`)

    want(read.ttl.toNumber()).equal(ttl)
    want(read.val).equal('0x' + val.toString('hex'))
  })


  //TODO: auth tests
  describe('some receiver tests', () => {
    let oracle, chainId;
    beforeEach(async () => {
      const BasicReceiverFactoryFactory = await ethers.getContractFactory('BasicReceiverFactory')
      const factory = await BasicReceiverFactoryFactory.deploy(fb.address)

      const tx = await factory.build()
      // debug('create', tx)
      const res = await tx.wait()
      const oracleAddr = res.events[0].args[0]

      oracle = await new ethers.Contract(oracleAddr, BasicReceiver.abi, signers[0])
      await oracle.setSigner(signers[0].address, 1000000000000)

      chainId = network.config.chainId;
    })

    //sequence number must increase
    it('seq #', async function () {
      const cost     = 10;
      const relayFee = 11;

      const setCost = await oracle.setCost(tag, cash.address, cost);
      const deposit = await fb.deposit(cash.address, signers[0].address, cost * 2, {value: cost * 2});
      const request = await fb.request(oracle.address, tag, cash.address, cost * 2);

      const digest = makeUpdateDigest({
        tag,
        val: val,
        seq: seq,
        sec: sec,
        ttl: ttl,
        chainId: chainId,
        receiver: oracle.address
      })
      debug(`digest: ${Buffer.from(digest).toString('hex')}`)

      const signature = await signers[0].signMessage(digest)
      debug(`signature ${signature}`)
      const sig = ethers.utils.splitSignature(signature)
      // debug(sig);

      await oracle.setRelayFee(tag, cash.address, relayFee);

      //submit twice with same seq
      await oracle.submit(tag, seq, sec, ttl, val, cash.address, sig.v, sig.r, sig.s);
      await fail('submit-seq', oracle.submit, tag, seq, sec, ttl, val, cash.address, sig.v, sig.r, sig.s);
    });

    //TODO: cost > relay fee
    it('collect (cost < relay fee)', async function () {
      const cost     = 10;
      const relayFee = 11;

      const setCost = await oracle.setCost(tag, cash.address, cost);
      const deposit = await fb.deposit(cash.address, signers[0].address, cost * 2);
      const request = await fb.request(oracle.address, tag, cash.address, cost * 2);
      await oracle.setRelayFee(tag, cash.address, relayFee);

      for( let i = 0; i < 2; i++ ) {
        const digest = makeUpdateDigest({
          tag,
          val: val,
          seq: seq + i,
          sec: sec,
          ttl: ttl,
          chainId: chainId,
          receiver: oracle.address
        })
        debug(`digest: ${Buffer.from(digest).toString('hex')}`)

        const signature = await signers[0].signMessage(digest)
        debug(`signature ${signature}`)
        const sig = ethers.utils.splitSignature(signature)
        // debug(sig);
        await oracle.submit(tag, seq + i, sec, ttl, val, cash.address, sig.v, sig.r, sig.s);
      }

      const bal     = await cash.balanceOf(signers[0].address);
      const collect = await oracle.collect(cash.address, signers[0].address);
      await collect.wait()

      want(await cash.balanceOf(signers[0].address)).to.eql(bal.add(cost * 2));
    });
  })

  describe('some fb tests', () => {

    describe('messing with costs', () => {

      describe('balance zero', () => {
        it('cost too high', async function () {
          const cost = 1
          const setCost = await fb.setCost(tag, cash.address, cost)
          fail('VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)',
            fb.push, tag, val, ttl, cash.address)
        })

        it('cost ok', async function () {
          const cost = 0
          const setCost = await fb.setCost(tag, cash.address, cost)
          await fb.push(tag, val, ttl, cash.address);
        })
      })

      describe('balance nonzero', () => {
        let bal;
        beforeEach(async () => {
          bal = 1000;
        })

        it('cost too high', async function () {
          const cost = 1001
          const setCost = await fb.setCost(tag, cash.address, cost)
          const deposit = await fb.deposit(cash.address, signers[0].address, bal, {value: bal});
          const request = await fb.request(signers[0].address, tag, cash.address, bal);
          await fail('VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)',
            fb.push, tag, val, ttl, cash.address)
        })

        it('cost ok', async function () {
          const cost = 1000
          const setCost = await fb.setCost(tag, cash.address, cost)
          const deposit = await fb.deposit(cash.address, signers[0].address, bal, {value: bal});
          const request = await fb.request(signers[0].address, tag, cash.address, bal);
          await fb.push(tag, val, ttl, cash.address);
        })
      })
      describe('deposit', () => {
        let bal;
        beforeEach(async () => {
          bal      = await cash.balanceOf(signers[0].address);
        })
        it('zero', async function () {
          const amt      = 0;
          const deposit  = await fb.deposit(cash.address, signers[0].address, amt, {value: amt});
          want(await cash.balanceOf(signers[0].address)).to.eql(bal.sub(amt));
        })
        it('nonzero', async function () {
          const amt      = 3;
          const deposit  = await fb.deposit(cash.address, signers[0].address, amt, {value: amt});
          want(await cash.balanceOf(signers[0].address)).to.eql(bal.sub(amt));
        })
      })

      describe('withdraw', () => {
        it('zero', async function () {
          const amt      = 0;
          const bal      = await cash.balanceOf(signers[0].address);
          const withdraw = await fb.withdraw(cash.address, signers[0].address, amt);
          want(await cash.balanceOf(signers[0].address)).to.eql(bal.add(amt));
        })
        it('nonzero', async function () {
          const amt      = 3;
          const deposit  = await fb.deposit(cash.address, signers[0].address, amt, {value: amt});
          const bal      = await cash.balanceOf(signers[0].address);
          const withdraw = await fb.withdraw(cash.address, signers[0].address, amt);
          want(await cash.balanceOf(signers[0].address)).to.eql(bal.add(amt));
        })
        it('balance too low', async function () {
          const amt      = 3;
          const deposit  = await fb.deposit(cash.address, signers[0].address, amt, {value: amt});
          await fail('underflow', fb.withdraw, cash.address, signers[0].address, amt+1);
        })
      })
    })
  })
})
