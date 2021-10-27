import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')

let cash
let fb
let signers

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  cash = cash.connect(signer)
  fb = fb.connect(signer)
}

describe('feedbase', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  let tag, seq, sec, ttl, val;
  let ali, bob;
  let ALI, BOB;
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob] = signers;
    [ALI, BOB] = [ali.address, bob.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()
 
    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')

    use(0)

    await send(cash.mint, ALI, 1000)
    await send(cash.approve, fb.address, UINT_MAX)

    await snapshot(hh);
  });
  beforeEach(async () => {
    await revert(hh);
    tag = Buffer.from('USDCASH'.padStart(32, '\0'))
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
  })
             
  it('ttl on read', async function () {
    const push = await send(fb.push, tag, val, ttl, '00'.repeat(20))
    const read = await fb.read(ALI, tag)
    debug(`read result ${read}`)

    want(read.ttl.toNumber()).equal(ttl)
    want(read.val).equal('0x' + val.toString('hex'))
  })


  it('zero cost too high', async function () {
    const cost = 1
    const setCost = await fb.setCost(tag, cash.address, cost)
    fail('VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)',
      fb.push, tag, val, ttl, cash.address)
  })

  it('zero cost ok', async function () {
    const cost = 0
    const setCost = await fb.setCost(tag, cash.address, cost)
    await fb.push(tag, val, ttl, cash.address);
  })

  it('nonzero cost too high', async function () {
    const bal = 1000;
    const cost = 1001
    const setCost = await fb.setCost(tag, cash.address, cost)
    const deposit = await fb.deposit(cash.address, ALI, bal, {value: bal});
    const request = await fb.request(ALI, tag, cash.address, bal);
    await fail('VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)',
      fb.push, tag, val, ttl, cash.address)
  })

  it('nonzero cost ok', async function () {
    const bal = 1000;
    const cost = 1000
    const setCost = await fb.setCost(tag, cash.address, cost)
    const deposit = await fb.deposit(cash.address, ALI, bal, {value: bal});
    const request = await fb.request(ALI, tag, cash.address, bal);
    await fb.push(tag, val, ttl, cash.address);
  })

  it('deposit zero', async function () {
    const bal = await cash.balanceOf(ALI);
    const amt      = 0;
    const deposit  = await fb.deposit(cash.address, ALI, amt, {value: amt});
    want(await cash.balanceOf(ALI)).to.eql(bal.sub(amt));
  })

  it('deposit nonzero', async function () {
    const bal = await cash.balanceOf(ALI);
    const amt      = 3;
    const deposit  = await fb.deposit(cash.address, ALI, amt, {value: amt});
    want(await cash.balanceOf(ALI)).to.eql(bal.sub(amt));
  })

  it('withdraw zero', async function () {
    const amt      = 0;
    const bal      = await cash.balanceOf(ALI);
    const withdraw = await fb.withdraw(cash.address, ALI, amt);
    want(await cash.balanceOf(ALI)).to.eql(bal.add(amt));
  })

  it('withdraw nonzero', async function () {
    const amt      = 3;
    const deposit  = await fb.deposit(cash.address, ALI, amt, {value: amt});
    const bal      = await cash.balanceOf(ALI);
    const withdraw = await fb.withdraw(cash.address, ALI, amt);
    want(await cash.balanceOf(ALI)).to.eql(bal.add(amt));
  })

  it('withdraw underflow', async function () {
    const amt      = 3;
    const deposit  = await fb.deposit(cash.address, ALI, amt, {value: amt});
    await fail('underflow', fb.withdraw, cash.address, ALI, amt+1);
  })

})
