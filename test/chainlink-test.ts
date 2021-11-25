import * as hh from 'hardhat'
import { ethers, network } from 'hardhat'
import { send, fail, chai, want, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')
const { hexlify } = ethers.utils

let cash
let fb
let signers
let oracle

const use = (n) => {
  const signer = signers[n]
  debug(`using ${n} ${signer.address}`)

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
  before(async () => {
    signers = await ethers.getSigners();
    [ali, bob] = signers;
    [ALI, BOB] = [ali.address, bob.address]

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const LinkDeployer = await ethers.getContractFactory('MockLink')
    cash = await LinkDeployer.deploy();

    const AdapterDeployer = await ethers.getContractFactory('ChainlinkAdapter');
    adapter = await AdapterDeployer.deploy(cash.address, fb.address);

    const OracleDeployer = await ethers.getContractFactory('MockOracle');
    oracle = await OracleDeployer.deploy(cash.address);

    use(0)

    //await send(cash.mint, ALI, 1000)
    await send(cash.approve, adapter.address, UINT_MAX)

    await snapshot(hh)
  })

  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from(cash.address.slice(2).padStart(64, '0'), 'hex')
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
  })

  it('basic', async function () {
    const amt = 10;
    const specId = Buffer.from('00'.repeat(32), 'hex');
    await send(adapter.deposit, cash.address, ALI, amt);

    const request = await adapter.request(oracle.address, specId, cash.address, amt);
    const evvies = await request.wait()
    const logs = await oracle.filters.OracleRequest(null, null,null,null,null,null,null,null,null);
    const _logs = await oracle.queryFilter(logs, 0);
    const args = _logs[0].args;

    const { events } = evvies
    
    await send(oracle.fulfillOracleRequest, Buffer.from(args.requestId.slice(2), 'hex'), args.payment, args.callbackAddr, Buffer.from(args.callbackFunctionId.slice(2), 'hex'), args.cancelExpiration, val);

    const res = await adapter.read(oracle.address, specId);

    want(res.val.slice(2)).equal(val.toString('hex'));
  });
})
