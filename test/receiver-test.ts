import { makeUpdateDigest } from '../scripts'

import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { want, send, fail, snapshot, revert } from 'minihat'

const debug = require('debug')('feedbase:test')

describe('receiver BasicReceiver BasicReceiverFactory', () => {
  let signers;
  let ali, bob;
  let ALI, BOB;
  let fb, fb_type;
  let rec, rec_type;

  let tag, sec, ttl, val;
  let chainId;

  const use = (n) => {
    const signer = signers[n]
    debug(`using ${n} ${signer.address}`)

    if (fb) fb = fb.connect(signer);
    if (rec) rec = rec.connect(signer);
  }

  before(async () => {
    [ali, bob] = await ethers.getSigners();
    signers = [ali, bob];
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
    sec = ethers.BigNumber.from(Date.now())
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
    chainId = hh.network.config.chainId;
  });

  it('auth', async function () {
    const auths = async (n) => {
      use(n);
      await rec.ward(signers[n].address, true);
      await rec.setSigner(signers[n].address, "test");
      want(await rec.isSigner(signers[n].address)).to.eq(true);
      want(await rec.wards(signers[n].address)).to.eq(true);
    }

    want(auths(1)).rejectedWith('bad-owner');
    await auths(0);
    await rec.ward(BOB, true);
    await rec.ward(ALI, false);
    want(auths(0)).rejectedWith('bad-owner');
    await auths(1);
    await rec.ward(ALI, true);
    await rec.ward(BOB, false);
    want(auths(1)).rejectedWith('bad-owner');
    await auths(0);
  });

  // fail when timestamp < sec or timestamp > ttl
  describe('submit preconditions', () => {
    let msg;
    it('ttl', async function () {
      msg = 'ErrTtl';
      ttl = Math.floor((await ethers.provider.getBlock("latest")).timestamp / 1000);
    });

    it('bad-signer unset', async function () {
      msg = 'ErrSigner';
      await rec.setSigner(ali.address, false);
    });

    afterEach(async () => {
      const digest = makeUpdateDigest({
        tag,
        val: val,
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

      await fail(msg, rec.submit, tag, sec, ttl, val, sig.v, sig.r, sig.s);
    });

  });

  describe('eip712 submit', () => {

    it('pass submit', async () => {
      const recChainId = await rec.chainId()
      want(chainId).equal(recChainId.toNumber())

      const digest = makeUpdateDigest({
        tag, val, sec, ttl,
        chainId: chainId,
        receiver: rec.address
      })

      const signature = await ali.signMessage(digest)
      const sig = ethers.utils.splitSignature(signature)
      await ethers.provider.send("evm_setNextBlockTimestamp", [Date.now()])
      await send(rec.submit, tag, sec, ttl, val, sig.v, sig.r, sig.s)
    });

    //Sec must be increasing
    it('sec must increase from last tag time / setCost deposit request submit', async function () {
      //sec = ethers.BigNumber.from(Date.now()).add(10000); // > block.timestamp
      let digest = makeUpdateDigest({
        tag, val, sec, ttl,
        chainId: chainId,
        receiver: rec.address
      })
      let signature = await ali.signMessage(digest)
      let sig = ethers.utils.splitSignature(signature)

      //submit with valid sec. Block.timestamp is >= sec and is the latest seen
      await ethers.provider.send("evm_setNextBlockTimestamp", [Date.now()])
      await rec.submit(tag, sec, ttl, val, sig.v, sig.r, sig.s);
      // Sec is not monotonically increasing
      await fail('ErrSeq', rec.submit, tag, sec, ttl, val, sig.v, sig.r, sig.s);
      // Sec is future leaking
      sec = ethers.BigNumber.from(Date.now()).add(10000);
      digest = makeUpdateDigest({
        tag, val, sec, ttl,
        chainId: chainId,
        receiver: rec.address
      })
      signature = await ali.signMessage(digest)
      sig = ethers.utils.splitSignature(signature)
      await fail('ErrSec', rec.submit, tag, sec, ttl, val, sig.v, sig.r, sig.s);
    });

  })

});
