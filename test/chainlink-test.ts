import { makeUpdateDigest } from '../src'
import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
const { constants, BigNumber, utils } = ethers
import { send, fail, chai, want, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

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

  if( link ) link = link.connect(signer);
  if( cash ) cash = cash.connect(signer);
  if( fb ) fb = fb.connect(signer);
  if( oracle ) oracle = oracle.connect(signer);
  if( adapter ) adapter = adapter.connect(signer);
  if( rec ) rec = rec.connect(signer);
  if( selector ) selector = selector.connect(signer);
  if( medianizer ) medianizer = medianizer.connect(signer);
}

let fulfill = async (x) => {
  const logs    = await oracle.filters.OracleRequest(null);
  const _logs   = await oracle.queryFilter(logs, 0);

  want(_logs.length).above(0)

  const args    = _logs[_logs.length - 1].args;
  const requestId = Buffer.from(args.requestId.slice(2), 'hex')
  await oracle.fulfillOracleRequest(requestId, x)
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

    const rec_type = await ethers.getContractFactory('BasicReceiver');
    rec = await rec_type.deploy(fb.address);

    const FixedSelectorProviderFactory = await ethers.getContractFactory('FixedSelectorProvider')
    selector = await FixedSelectorProviderFactory.deploy()

    const MedianizerFactory = await ethers.getContractFactory('MedianizerCombinator')
    medianizer = await MedianizerFactory.deploy(selector.address, fb.address)



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

  describe('all', () => {
    it('receiver adapter direct', async function () {

      const vals = [1000, 1200, 1300].map(x => utils.hexZeroPad(utils.hexValue(x), 32))
      const ttl = 10 * 10 ** 12
      const sources = [bob, rec, oracle]
      const selectors = sources.map(s => s.address)
      const readers = [fb.address, fb.address, adapter.address];

      debug('selectors');
      await selector.setSelectors(selectors, readers)

      debug('deposit fb...');
      await send(link.approve, fb.address, amt*3);
      await send(fb.deposit, link.address, ALI, amt*3);
      debug('requesting...');
      //TODO medianizer needs to be updated
      await send(fb.request, medianizer.address, tag, link.address, amt*3)
      await send(link.approve, adapter.address, amt);
      await send(adapter.deposit, link.address, medianizer.address, amt)
      debug('poke...');
      await send(medianizer.poke, tag, link.address)

      use(1);

      debug('pushing...');
      await Promise.all([
        async () => {
          await fb.push(tag, vals[0], ttl, link.address);
          debug('direct feed done');
        },
        async () => {
          //TODO do we need this?
          const valBuf = Buffer.from(vals[1].slice(2), 'hex');
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
          await send(rec.connect(ali).setSigner, BOB, ttl);
          await send(rec.submit, tag, seq, sec, ttl, valBuf, link.address, sig.v, sig.r, sig.s)
          debug('receiver submit done');
        },
        async () => {
          await fulfill(vals[2]);
          debug('oracle fulfillment done');
        }
      ].map(x => x()));
    
      debug('medianizer push');
      await medianizer.push(tag)
      debug('read from medianizer');
      const [median] = await fb.read(medianizer.address, tag)
      want(BigNumber.from(median).toNumber()).to.eql(1200)
    });
  });
});
