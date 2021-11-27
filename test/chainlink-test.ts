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

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

  if( link ) link = link.connect(signer);
  if( cash ) cash = cash.connect(signer);
  if( fb ) fb = fb.connect(signer);
  if( oracle ) oracle = oracle.connect(signer);
}

describe('chainlink', () => {
  const UINT_MAX = Buffer.from('ff'.repeat(32), 'hex')
  const decimals = 18;
  const initialAnswer = 0;
  let tag, seq, sec, ttl, val
  let ali, bob
  let ALI, BOB
  let registry, link, aggregator, adapter;
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
    specId = Buffer.from('00'.repeat(32), 'hex');
    await send(adapter.setCost, oracle.address, specId, cash.address, amt);
  })

  describe('e2e', () => {
    it('basic', async function () {
      // check balance of user before
      const bal = await adapter.balances(ALI, cash.address)
      debug('balance before: ', bal.toString())

      await send(adapter.deposit, link.address, ALI, amt);
      const request = await adapter.request(oracle.address, specId, link.address, amt);
      await request.wait()

      // check balance of user after
      const after = await adapter.balances(ALI, cash.address)
      debug('balance after: ', after.toString())
    });

    /*
    it('non-link tokens', async function () {
      await send(adapter.deposit, cash.address, ALI, amt);
      const request = await adapter.request(oracle.address, specId, cash.address, amt);
      await request.wait()
    });
   */

    afterEach(async () => {
      const logs    = await oracle.filters.OracleRequest(null);
      const _logs   = await oracle.queryFilter(logs, 0);

      want(_logs.length).above(0)

      const args    = _logs[0].args;
      const requestId = Buffer.from(args.requestId.slice(2), 'hex')
      await oracle.fulfillOracleRequest(requestId, val)

      const res = await adapter.read(oracle.address, specId);
      want(res.val.slice(2)).equal(val.toString('hex'));
    });
  });
})
