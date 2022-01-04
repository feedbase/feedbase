import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let fb
let signers
let oracle

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  if( fb ) fb = fb.connect(signer);
  if( oracle ) oracle = oracle.connect(signer);
}

describe('feedbase', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  let tag, seq, sec, ttl, val
  let ali, bob
  let ALI, BOB
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob] = signers;
    [ALI, BOB] = [ali.address, bob.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const TokenDeployer = await ethers.getContractFactory('MockToken')

    use(0)


    await snapshot(hh)
  })
  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from('USDCASH'.padStart(32, '\0'))
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
  })

  it('ttl on read', async function () {
    const push = await send(fb.push, tag, val, ttl)
    const read = await fb.read(ALI, tag)
    debug(`read result ${read}`)

    want(read.ttl.toNumber()).equal(ttl)
    want(read.val).equal('0x' + val.toString('hex'))
  })

  it('read successive', async function () {
    let push = await fb.push(tag, val, ttl)
    await push.wait()
    let read = await fb.read(ALI, tag)
    debug(`read result ${read}`)

    want(read.ttl.toNumber()).equal(ttl)
    want(read.val).equal('0x' + val.toString('hex'))

    // read doesn't change value
    read = await fb.read(ALI, tag);
    want(read.ttl.toNumber()).equal(ttl)
    want(read.val).equal('0x' + val.toString('hex'))

    // push changes value
    val = Buffer.from('22'.repeat(32), 'hex');
    const timestamp = (await ethers.provider.getBlock(push.blockNumber)).timestamp;
    await network.provider.request({
      method: "evm_setNextBlockTimestamp",
      params: [timestamp + 1]
    });
    ttl = timestamp + 2;
    await fb.push(tag, val, ttl)
    read = await fb.read(ALI, tag);
    want(read.ttl.toNumber()).equal(ttl);
    want(read.val).equal('0x' + val.toString('hex'));

    ttl = Math.floor(Date.now() / 1000) - 1;
    await fb.push(tag, val, ttl)
    await want(fb.read(ALI, tag)).rejectedWith('ERR_READ');
  });

  it('Push event', async function () {
    const bal = 1000
    const tx = await fb.push(tag, val, ttl)
    const { events } = await tx.wait()
    const [{ args }] = events

    want(args.src).to.eql(ALI)
    want(hexlify(args.tag)).to.eql(hexlify(tag))
    want(hexlify(args.val)).to.eql(hexlify(val))
    want(args.ttl.toNumber()).to.eql(ttl)
  })

})
