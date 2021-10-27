import { makeUpdateDigest } from '../src'

import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { want, send, fail, snapshot, revert, U256_MAX } from 'minihat'

const debug = require('debug')('feedbase:test')

describe('receiver BasicReceiver BasicReceiverFactory', ()=>{
  let ali, bob;
  let ALI, BOB;
  let fb, fb_type;
  let rec, rec_type;
  let recfab, recfab_type;
  let cash,  cash_type;

  let tag, seq, sec, ttl, val;
  let chainId;

  before(async () => {
    [ali, bob] = await ethers.getSigners();
    [ALI, BOB] = [ali.address, bob.address];

    fb_type = await ethers.getContractFactory('Feedbase');
    fb = await fb_type.deploy();

    rec_type = await ethers.getContractFactory('BasicReceiver');
    rec = await rec_type.deploy(fb.address);

    cash_type = await ethers.getContractFactory('MockToken');
    cash = await cash_type.deploy('CASH', 'CASH');

    await send(cash.mint, ALI, 1000)
    await send(cash.approve, fb.address, U256_MAX)

    await send(rec.setSigner, ALI, 1000000000000)

    await snapshot(hh);
  });
  beforeEach(async () => {
    await revert(hh)
    tag = Buffer.from('USDCASH'.padStart(32, '\0'))
    seq = 1
    sec = Math.floor(Date.now() / 1000)
    ttl = 10000000000000
    val = Buffer.from('11'.repeat(32), 'hex')
    chainId = hh.network.config.chainId;
  })

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
      await send(rec.submit, tag, seq, sec, ttl, val, '0'.repeat(40), sig.v, sig.r, sig.s)
    });

    //sequence number must increase
    it('seq must increase / setCost deposit request submit', async function () {
      const cost     = 10;
      const relayFee = 11;

      const setCost = await rec.setCost(tag, cash.address, cost);
      const deposit = await fb.deposit(cash.address, ALI, cost * 2, {value: cost * 2});
      const request = await fb.request(rec.address, tag, cash.address, cost * 2);

      const digest = makeUpdateDigest({
        tag, val, seq, sec, ttl,
        chainId: chainId,
        receiver: rec.address
      })
      const signature = await ali.signMessage(digest)
      const sig = ethers.utils.splitSignature(signature)

      await rec.setRelayFee(tag, cash.address, relayFee);

      //submit twice with same seq
      await rec.submit(tag, seq, sec, ttl, val, cash.address, sig.v, sig.r, sig.s);
      await fail('submit-seq', rec.submit, tag, seq, sec, ttl, val, cash.address, sig.v, sig.r, sig.s);
    });

    //TODO: cost > relay fee
    it('collect (cost < relay fee)', async function () {
      const cost     = 10;
      const relayFee = 11;

      const setCost = await rec.setCost(tag, cash.address, cost);
      const deposit = await fb.deposit(cash.address, ALI, cost * 2);
      const request = await fb.request(rec.address, tag, cash.address, cost * 2);
      await rec.setRelayFee(tag, cash.address, relayFee);

      for( let i = 0; i < 2; i++ ) {
        const digest = makeUpdateDigest({
          tag,
          val: val,
          seq: seq + i,
          sec: sec,
          ttl: ttl,
          chainId: chainId,
          receiver: rec.address
        })

        const signature = await ali.signMessage(digest)
        const sig = ethers.utils.splitSignature(signature)
        await rec.submit(tag, seq + i, sec, ttl, val, cash.address, sig.v, sig.r, sig.s);
      }

      const bal     = await cash.balanceOf(ALI);
      const collect = await rec.collect(cash.address, ALI);
      await collect.wait()

      want(await cash.balanceOf(ALI)).to.eql(bal.add(cost * 2));
    });

  })


});
