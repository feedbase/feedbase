import { makeUpdateDigest } from '../src'

import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { getter } from '../src/sensors/USDETH_coingecko'
import * as sensor from '../src/sensor'
import { want, send, fail, snapshot, revert, U256_MAX } from 'minihat'

const debug = require('debug')('feedbase:sensor')

describe('receiver BasicReceiver BasicReceiverFactory', ()=>{
  let signers : ethers.Wallet;
  let ali, bob;
  let ALI, BOB;
  let fb, fb_type;
  let rec, rec_type;
  let recfab, recfab_type;
  let cash,  cash_type;
  let opts = { receiver:undefined, chainId:undefined, signer:undefined};

  let tag, seq, sec, ttl, val;
  let chainId;

  const use = (n) => {
    const signer = signers[n]
    debug(`using ${n} ${signer.address}`)

    if( cash ) cash = cash.connect(signer);
    if( fb ) fb = fb.connect(signer);
    if( rec ) rec = rec.connect(signer);
  }

  before(async () => {
    [ali, bob] = await ethers.getSigners();
    signers    = [ali, bob];
    [ALI, BOB] = [ali.address, bob.address];

    fb_type = await ethers.getContractFactory('Feedbase');
    fb = await fb_type.deploy();

    rec_type = await ethers.getContractFactory('BasicReceiver');
    rec = await rec_type.deploy(fb.address);

    cash_type = await ethers.getContractFactory('MockToken');
    cash = await cash_type.deploy('CASH', 'CASH');

    await send(cash.mint, ALI, 1000)
    await send(cash.approve, fb.address, U256_MAX)

    await send(rec.setSigner, BOB, 1000000000000)

    await snapshot(hh);
  })

  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from('USDCASH'.padStart(32, '\0'))
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
    chainId = hh.network.config.chainId;
  });

  describe('sensor', ()=>{
    beforeEach(async () => {
      opts.receiver = rec.address;
      opts.chainId  = chainId;
      opts.signer   = bob;
      opts.cash     = cash.address;
      opts.interval = 0;
      opts.tag      = tag;
      use(0);
    });
    afterEach(async () => {
      use(0);
    });

    it('cost too high', async () => {
      const digest = makeUpdateDigest({
        tag, val, seq, sec, ttl,
        chainId: chainId,
        receiver: rec.address
      })
      const setCost = await rec.setCost(tag, cash.address, 10000000);
      await setCost.wait();

      await want(sensor.serve(getter, opts)).rejectedWith('underflowed');
    });
  })
});

