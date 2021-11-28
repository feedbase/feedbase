import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let link
let cash
let fb
let signers
let oracle
let adapter

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  if( link ) link = link.connect(signer);
  if( cash ) cash = cash.connect(signer);
  if( fb ) fb = fb.connect(signer);
  if( oracle ) oracle = oracle.connect(signer);
  if( adapter ) adapter = adapter.connect(signer);
}

describe('chainlink', () => {
  const ZERO = ethers.BigNumber.from(0);
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  const decimals = 18;
  const initialAnswer = 0;
  let tag, seq, sec, ttl, val
  let ali, bob
  let ALI, BOB
  let cash;
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob] = signers;
    [ALI, BOB] = [ali.address, bob.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const LinkDeployer = await ethers.getContractFactory('MockLink')
    link = await LinkDeployer.deploy();

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH');

    const AdapterDeployer = await ethers.getContractFactory('ChainlinkAdapter');
    adapter = await AdapterDeployer.deploy(link.address, fb.address);

    const OracleDeployer = await ethers.getContractFactory('MockOracle');
    oracle = await OracleDeployer.deploy(link.address);

    use(0)

    await send(cash.mint, ALI, 1000)
    await send(cash.approve, adapter.address, UINT_MAX)
    await send(link.approve, adapter.address, UINT_MAX)

    await snapshot(hh)
  })

  let amt, specId;
  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from(link.address.slice(2).padStart(64, '0'), 'hex')
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
    amt = 10;
    specId = Buffer.from('ff'.repeat(32), 'hex');
    use(0);
  })

  describe('setup', () => {
    describe('deposit', () => {
      let bal;
      beforeEach(async () => {
        bal = 1000;
      });

      it('success', async function () {
        want((await adapter.balances(ALI, link.address)).toNumber()).to.eql(0);
        await send(adapter.deposit, link.address, BOB, bal);
        want((await adapter.balances(BOB, link.address)).toNumber()).to.equal(bal);
      });

      // TODO transferFrom return value tests
      it('erc20 transfer fail', async function () {
        await send(link.transfer, BOB, bal);
        use(1);
        await fail('', adapter.deposit, link.address, BOB, bal+1);
      });
    });

    describe('withdraw', () => {
      let bal, prev;
      beforeEach(async () => {
        bal = 1000
        prev = await link.balanceOf(ALI);
      });

      it('withdraw', async function () {
        await send(adapter.deposit, link.address, ALI, bal);
        await send(adapter.withdraw, link.address, ALI, bal);
        want(await adapter.balances(ALI, link.address)).to.eql(ZERO);
      });

      it('withdraw to other user', async function () {
        await send(adapter.deposit, link.address, ALI, bal);
        await send(adapter.withdraw, link.address, BOB, bal);
        want(await adapter.balances(ALI, link.address)).to.eql(ZERO);
        want(await link.balanceOf(BOB)).to.eql(ethers.BigNumber.from(bal));
      });

      it('withdraw underflow', async function () {
        await send(adapter.deposit, link.address, ALI, bal);
        await fail('underflow', adapter.withdraw, link.address, BOB, bal+1);
      });
    });

    // TODO permissions
    it('get/setCost', async function () {
      const cost = 1;
      want((await adapter.getCost(oracle.address, specId, link.address)).toNumber()).to.equal(0);
      await send(adapter.setCost, oracle.address, specId, link.address, cost);
      want((await adapter.getCost(oracle.address, specId, link.address)).toNumber()).to.equal(cost);
    });

    describe('requested', () => {
      beforeEach(async () => {
        await send(adapter.setCost, oracle.address, specId, link.address, amt);
        // check balance of user before
        const bal = await adapter.balances(ALI, link.address)
        debug('balance before: ', bal.toString())

        await send(adapter.deposit, link.address, ALI, amt);
        const request = await adapter.request(oracle.address, specId, link.address, amt);
        await request.wait()

        // check balance of user after
        const after = await adapter.balances(ALI, link.address)
        debug('balance after: ', after.toString())
      });

      it('not found', async function () {
        await fail('invalid oracle,specId pair', adapter.requested, oracle.address, Buffer.from('00'.repeat(32), 'hex'), link.address);
        await fail('invalid oracle,specId pair', adapter.requested, cash.address, specId, link.address);
        await fail('invalid oracle,specId pair', adapter.requested, cash.address, Buffer.from('00'.repeat(32), 'hex'), link.address);
      });

      it('found', async function () {
        const requested = await adapter.requested(oracle.address, specId, link.address);
        want(requested.toNumber()).to.equal(amt);
      });
    });
  });

  describe('core', () => {


  });

  it('read', async function () {
    await fail('read: invalid oracle,specId', adapter.read, oracle.address, specId);

    await send(adapter.setCost, oracle.address, specId, link.address, amt);
    // check balance of user before
    const bal = await adapter.balances(ALI, link.address)
    debug('balance before: ', bal.toString())

    await send(adapter.deposit, link.address, ALI, amt);
    const request = await adapter.request(oracle.address, specId, link.address, amt);
    await request.wait()

    // pending
    await fail('ERR_READ', adapter.read, oracle.address, specId);

    // check balance of user after
    const after = await adapter.balances(ALI, link.address)
    debug('balance after: ', after.toString())

    let fulfill = async (x) => {
      const logs    = await oracle.filters.OracleRequest(null);
      const _logs   = await oracle.queryFilter(logs, 0);

      want(_logs.length).above(0)

      const args    = _logs[_logs.length - 1].args;
      const requestId = Buffer.from(args.requestId.slice(2), 'hex')
      await oracle.fulfillOracleRequest(requestId, x)
    }

    await fulfill(val);

    let res = await adapter.read(oracle.address, specId);
    want(res.val.slice(2)).equal(val.toString('hex'));

    await send(adapter.deposit, link.address, ALI, amt);
    await send(adapter.request, oracle.address, specId, link.address, amt);

    // pending
    res = await adapter.read(oracle.address, specId);
    want(res.val.slice(2)).equal(val.toString('hex'));

    let newVal = Buffer.from('44'.repeat(32), 'hex')
    await fulfill(newVal);
    res = await adapter.read(oracle.address, specId);
    want(res.val.slice(2)).equal(newVal.toString('hex'));









  });
});
