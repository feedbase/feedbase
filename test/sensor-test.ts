import { makeUpdateDigest } from '../scripts'

import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { getter } from '../scripts/sensors/USDETH_coingecko'
import * as sensor from '../scripts/sensor'
import { want, send, fail, snapshot, revert, U256_MAX } from 'minihat'

const debug = require('debug')('feedbase:sensor')

describe('receiver BasicReceiver BasicReceiverFactory', ()=>{
  let signers : [any, any];
  let ali, bob;
  let ALI, BOB;
  let fb, fb_type;
  let rec, rec_type;
  let recfab, recfab_type;
  let opts = { receiver:undefined, chainId:undefined, signer:undefined, tag:undefined, interval:undefined };

  let tag, seq, sec, ttl, val;
  let chainId;

  const use = (n) => {
    const signer = signers[n]
    debug(`using ${n} ${signer.address}`)

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
      opts.interval = 0;
      opts.tag      = tag;
      use(0);
    });
    afterEach(async () => {
      use(0);
    });

  })
});
