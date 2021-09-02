const debug = require('debug')('feedbase:test')
const want = require('chai').expect

const BN = require('bn.js')

const Feedbase = require('../artifacts/contracts/Feedbase.sol/Feedbase.json')
const BasicReceiverFactory = require('../artifacts/contracts/Receiver.sol/BasicReceiverFactory.json')
const BasicReceiver = require('../artifacts/contracts/Receiver.sol/BasicReceiver.json')

const { ethers, network } = require('hardhat')

const { makeUpdateDigest } = require('..')

describe('feedbase', () => {
  it('basics', async function () {
    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()
  })

  it('oracle relay', async function () {
    const { chainId } = network.config
    debug('chainId: ', chainId)

    const signers = await ethers.getSigners()
    // debug(signers[0])
    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()
    const BasicReceiverFactoryFactory = await ethers.getContractFactory('BasicReceiverFactory')
    const factory = await BasicReceiverFactoryFactory.deploy(fb.address)

    const tx = await factory.build()
    // debug('create', tx)
    const res = await tx.wait()
    const oracleAddr = res.events[0].args[0]

    const oracle = await new ethers.Contract(oracleAddr, BasicReceiver.abi, signers[0])
    const tx2 = await oracle.setSigner(signers[0].address, 1000000000000)
    await tx2.wait()

    const sttl = await oracle.signerTTL(signers[0].address)
    debug(`sttl: ${sttl}`)

    const oracleChainId = await oracle.chainId()
    debug(`oracleChainId: ${oracleChainId}`)
    want(chainId).equal(oracleChainId)

    const tag = Buffer.from('USDETH'.padStart(32, '\0'))
    const seq = 1
    const sec = Math.floor(Date.now() / 1000)
    const ttl = 10000000000000
    const val = Buffer.from('11'.repeat(32), 'hex')
    debug(tag, seq, sec, ttl, val)
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
    const tx3 = await oracle.submit(tag, seq, sec, ttl, val, sig.v, sig.r, sig.s)
  })

  it('ttl on read', async function () {
    const signers = await ethers.getSigners()
    // debug(signers[0]);

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()

    const tag = Buffer.from('USDETH'.padStart(32, '\0'))
    const seq = 1
    const sec = Math.floor(Date.now() / 1000)
    const ttl = 10000000000000
    const val = Buffer.from('11'.repeat(32), 'hex')
    debug(tag, seq, sec, ttl, val)

    const push = await fb.pushFree(tag, ttl, val)
    const read = await fb.read(signers[0].address, tag)
    debug(`read result ${read}`)

    want(read.ttl).equal(ttl)
    want(read.val).equal('0x' + val.toString('hex'))
  })
})
