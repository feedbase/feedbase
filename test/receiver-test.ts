import { makeUpdateDigest } from '../scripts'

import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { want, send, fail, snapshot, revert, U256_MAX } from 'minihat'

const debug = require('debug')('feedbase:test')

describe('receiver BasicReceiver BasicReceiverFactory', ()=>{
  let signers;
  let ali, bob;
  let ALI, BOB;
  let fb, fb_type;
  let rec, rec_type;
  let recfab, recfab_type;

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

    await send(rec.setSigner, ALI, 1000000000000)

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

  it('auth', async function () {
    const auths = async (n) => {
      use(n);
      await rec.setOwner(signers[n].address);
      await rec.setSigner(signers[n].address, 1000);
    }

    want(auths(1)).rejectedWith('bad-owner');
    await auths(0);
    await rec.setOwner(BOB);
    want(auths(0)).rejectedWith('bad-owner');
    await auths(1);
    await rec.setOwner(ALI);
    want(auths(1)).rejectedWith('bad-owner');
    await auths(0);
  });
  
  // fail when timestamp < sec or timestamp > ttl
  describe('submit preconditions', () => {
    let msg;
    it('ttl', async function () {
      msg = 'ttl';
      ttl = sec;
    });
    it('sec', async function () {
      msg = 'sec';
      sec = ttl;
    });
    it('signer ttl', async function () {
      msg = 'bad-signer';
      //await rec.setSigner(ALI, sec);
      await rec.setSigner(ALI, sec);
    });
  
    afterEach(async () => {
      const cost     = 10;
      const relayFee = 11;

      const digest = makeUpdateDigest({
        tag,
        val: val,
        seq: seq,
        sec: sec,
        ttl: ttl,
        chainId: chainId,
        receiver: rec.address
      })
      debug(`digest: ${Buffer.from(digest).toString('hex')}`)

      const signature = await ali.signMessage(digest)
      debug(`signature ${signature}`)
      const sig = ethers.utils.splitSignature(signature)
      // debug(sig);

      await fail(msg, rec.submit, tag, seq, sec, ttl, val, sig.v, sig.r, sig.s);
    });

  });

  describe('eip712 submit', ()=>{

    it('pass submit', async () => {
      const recChainId = await rec.chainId()
      want(chainId).equal(recChainId.toNumber())

      const digest = makeUpdateDigest({
        tag, val, seq, sec, ttl,
        chainId: chainId,
        receiver: rec.address
      })

      const signature = await ali.signMessage(digest)
      const sig = ethers.utils.splitSignature(signature)
      await send(rec.submit, tag, seq, sec, ttl, val, sig.v, sig.r, sig.s)
    });

    //sequence number must increase
    it('seq must increase / setCost deposit request submit', async function () {
      const digest = makeUpdateDigest({
        tag, val, seq, sec, ttl,
        chainId: chainId,
        receiver: rec.address
      })
      const signature = await ali.signMessage(digest)
      const sig = ethers.utils.splitSignature(signature)

      //submit twice with same seq
      await rec.submit(tag, seq, sec, ttl, val, sig.v, sig.r, sig.s);
      await fail('submit-seq', rec.submit, tag, seq, sec, ttl, val, sig.v, sig.r, sig.s);
    });

  })

});
