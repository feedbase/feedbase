const debug = require('debug')('feedbase:test')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const want = chai.expect

const Feedbase = require('../artifacts/contracts/Feedbase.sol/Feedbase.json')
const BasicReceiverFactory = require('../artifacts/contracts/Receiver.sol/BasicReceiverFactory.json')
const BasicReceiver = require('../artifacts/contracts/Receiver.sol/BasicReceiver.json')

const { ethers, network } = require('hardhat')

const { makeUpdateDigest } = require('../src')

async function send(...args) {
  const f = args[0];
  const fargs = args.slice(1);
  const tx = await f(...fargs);
  return await tx.wait()
}

async function fail(...args) {
  const err = args[0];
  const sargs = args.slice(1);
  await want(send(...sargs)).rejectedWith(err);
}



describe('feedbase', () => {
  it('basics', async function () {
    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()
  })

  it('oracle relay', async function () {
    const { chainId } = network.config
    debug('chainId: ', chainId)

    const signers = await ethers.getSigners()
    // debug(signers[0])
    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()
    const BasicReceiverFactoryFactory = await ethers.getContractFactory('BasicReceiverFactory')
    const factory = await BasicReceiverFactoryFactory.deploy(fb.address)

    const tx = await factory.build()
    // debug('create', tx)
    const res = await tx.wait()
    const oracleAddr = res.events[0].args[0]

    const oracle = await new ethers.Contract(oracleAddr, BasicReceiver.abi, signers[0])
    const tx2 = await oracle.setSigner(signers[0].address, 1000000000000)
    await tx2.wait()

    const sttl = await oracle.signerTTL(signers[0].address)
    debug(`sttl: ${sttl}`)

    const oracleChainId = await oracle.chainId()
    debug(`chainId: ${chainId}, type ${typeof (chainId)}`)
    debug(`oracleChainId: ${oracleChainId}, type ${typeof (oracleChainId)}`)
    want(chainId).equal(oracleChainId.toNumber())

    const tag = Buffer.from('USDETH'.padStart(32, '\0'))
    const seq = 1
    const sec = Math.floor(Date.now() / 1000)
    const ttl = 10000000000000
    const val = Buffer.from('11'.repeat(32), 'hex')
    debug(tag, seq, sec, ttl, val)
    const digest = makeUpdateDigest({
      tag,
      val: val,
      seq: seq,
      sec: sec,
      ttl: ttl,
      chainId: chainId,
      receiver: oracle.address
    })
    debug(`digest: ${Buffer.from(digest).toString('hex')}`)

    const signature = await signers[0].signMessage(digest)
    debug(`signature ${signature}`)
    const sig = ethers.utils.splitSignature(signature)
    // debug(sig);
    const tx3 = await oracle.submit(tag, seq, sec, ttl, val, '0'.repeat(40), sig.v, sig.r, sig.s)
  })

  it('ttl on read', async function () {
    const signers = await ethers.getSigners()
    // debug(signers[0]);

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    const fb = await FeedbaseFactory.deploy()

    const tag = Buffer.from('USDETH'.padStart(32, '\0'))
    const seq = 1
    const sec = Math.floor(Date.now() / 1000)
    const ttl = 10000000000000
    const val = Buffer.from('11'.repeat(32), 'hex')
    debug(tag, seq, sec, ttl, val)

    const push = await fb.push(tag, val, ttl, '00'.repeat(20))
    const read = await fb.read(signers[0].address, tag)
    debug(`read result ${read}`)

    want(read.ttl.toNumber()).equal(ttl)
    want(read.val).equal('0x' + val.toString('hex'))
  })


  //TODO: auth tests
  describe('some receiver tests', () => {
    let signers, fb, oracle, tag, seq, sec, ttl, val, cash, chainId;
    beforeEach(async () => {
      signers = await ethers.getSigners()
      // debug(signers[0]);
      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()
      const BasicReceiverFactoryFactory = await ethers.getContractFactory('BasicReceiverFactory')
      const factory = await BasicReceiverFactoryFactory.deploy(fb.address)

      const tx = await factory.build()
      // debug('create', tx)
      const res = await tx.wait()
      const oracleAddr = res.events[0].args[0]

      oracle = await new ethers.Contract(oracleAddr, BasicReceiver.abi, signers[0])
      await oracle.setSigner(signers[0].address, 1000000000000)

      tag = Buffer.from('USDETH'.padStart(32, '\0'))
      seq = 1
      sec = Math.floor(Date.now() / 1000)
      ttl = 10000000000000
      val = Buffer.from('11'.repeat(32), 'hex')
      debug(tag, seq, sec, ttl, val)
      cash    = '0'.repeat(40);

      chainId = network.config.chainId;
 
    })

    //sequence number must increase
    it('seq #', async function () {
      const cost     = 10;
      const relayFee = 11;

      const setCost = await oracle.setCost(tag, cash, cost);
      const deposit = await fb.deposit(cash, cost * 2, {value: cost * 2});
      const request = await fb.request(oracle.address, tag, cash, cost * 2);

      const digest = makeUpdateDigest({
        tag,
        val: val,
        seq: seq,
        sec: sec,
        ttl: ttl,
        chainId: chainId,
        receiver: oracle.address
      })
      debug(`digest: ${Buffer.from(digest).toString('hex')}`)

      const signature = await signers[0].signMessage(digest)
      debug(`signature ${signature}`)
      const sig = ethers.utils.splitSignature(signature)
      // debug(sig);

      await oracle.setRelayFee(tag, cash, relayFee);

      //submit twice with same seq
      await oracle.submit(tag, seq, sec, ttl, val, '0'.repeat(40), sig.v, sig.r, sig.s);
      await fail('submit-seq', oracle.submit, tag, seq, sec, ttl, val, '0'.repeat(40), sig.v, sig.r, sig.s);
    });

    //TODO: cost > relay fee
    it('collect (cost < relay fee)', async function () {
      const cost     = 10;
      const relayFee = 11;

      const setCost = await oracle.setCost(tag, cash, cost);
      const deposit = await fb.deposit(cash, cost * 2, {value: cost * 2});
      const request = await fb.request(oracle.address, tag, cash, cost * 2);
      await oracle.setRelayFee(tag, cash, relayFee);

      for( let i = 0; i < 2; i++ ) {
        const digest = makeUpdateDigest({
          tag,
          val: val,
          seq: seq + i,
          sec: sec,
          ttl: ttl,
          chainId: chainId,
          receiver: oracle.address
        })
        debug(`digest: ${Buffer.from(digest).toString('hex')}`)

        const signature = await signers[0].signMessage(digest)
        debug(`signature ${signature}`)
        const sig = ethers.utils.splitSignature(signature)
        // debug(sig);
        await oracle.submit(tag, seq + i, sec, ttl, val, '0'.repeat(40), sig.v, sig.r, sig.s);
      }

      const bal     = await signers[0].getBalance();
      const collect = await oracle.collect(cash);
      const fee     = collect.gasPrice.mul((await collect.wait()).gasUsed);

      want(await signers[0].getBalance()).to.eql(bal.add(cost * 2).sub(fee));
    });
  })

  describe('some fb tests', () => {
    let signers, fb;
    beforeEach(async () => {
      signers = await ethers.getSigners()
      // debug(signers[0]);
      const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
      fb = await FeedbaseFactory.deploy()
    })

    describe('messing with costs', () => {
      let tag, seq, sec, ttl, val, cash;
      beforeEach(async () => {
        tag = Buffer.from('USDETH'.padStart(32, '\0'))
        seq = 1
        sec = Math.floor(Date.now() / 1000)
        ttl = 10000000000000
        val = Buffer.from('11'.repeat(32), 'hex')
        debug(tag, seq, sec, ttl, val)
        cash = '00'.repeat(20)
      })

      describe('balance zero', () => {
        it('cost too high', async function () {
          const cost = 1
          const setCost = await fb.setCost(tag, cash, cost)
          fail('VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)',
            fb.push, tag, val, ttl, cash)
        })

        it('cost ok', async function () {
          const cost = 0
          const setCost = await fb.setCost(tag, cash, cost)
          await fb.push(tag, val, ttl, cash);
        })
      })

      describe('balance nonzero', () => {
        let bal;
        beforeEach(async () => {
          bal = 1000;
        })

        it('cost too high', async function () {
          const cost = 1001
          const setCost = await fb.setCost(tag, cash, cost)
          const deposit = await fb.deposit(cash, bal, {value: bal});
          const request = await fb.request(signers[0].address, tag, cash, bal);
          fail('VM Exception while processing transaction: reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)',
            fb.push, tag, val, ttl, cash)
        })

        it('cost ok', async function () {
          const cost = 1000
          const setCost = await fb.setCost(tag, cash, cost)
          const deposit = await fb.deposit(cash, bal, {value: bal});
          const request = await fb.request(signers[0].address, tag, cash, bal);
          await fb.push(tag, val, ttl, cash);
        })
      })
      describe('deposit', () => {
        let bal;
        beforeEach(async () => {
          bal      = await signers[0].getBalance();
        })
        it('zero', async function () {
          //const bal      = await signers[0].getBalance();
          const amt      = 0;
          const deposit  = await fb.deposit(cash, amt, {value: amt});
          let fee = deposit.gasPrice.mul((await deposit.wait()).gasUsed);
          want(await signers[0].getBalance()).to.eql(bal.sub(fee).sub(amt));
        })
        it('nonzero', async function () {
          //const bal      = await signers[0].getBalance();
          const amt      = 3;
          const deposit  = await fb.deposit(cash, amt, {value: amt});
          let fee = deposit.gasPrice.mul((await deposit.wait()).gasUsed);
          want(await signers[0].getBalance()).to.eql(bal.sub(fee).sub(amt));
        })
      })

      describe('withdraw', () => {
        it('zero', async function () {
          //const bal      = await signers[0].getBalance();
          const amt      = 0;
          const bal      = await signers[0].getBalance();
          const withdraw = await fb.withdraw(cash, amt);
          let fee = withdraw.gasPrice.mul((await withdraw.wait()).gasUsed);
          want(await signers[0].getBalance()).to.eql(bal.sub(fee).add(amt));
        })
        it('nonzero', async function () {
          //const bal      = await signers[0].getBalance();
          const amt      = 3;
          const deposit  = await fb.deposit(cash, amt, {value: amt});
          const bal      = await signers[0].getBalance();
          const withdraw = await fb.withdraw(cash, amt);
          let fee = withdraw.gasPrice.mul((await withdraw.wait()).gasUsed);
          want(await signers[0].getBalance()).to.eql(bal.sub(fee).add(amt));
        })
        it('balance too low', async function () {
          const amt      = 3;
          const deposit  = await fb.deposit(cash, amt, {value: amt});
          fail('underflow', fb.withdraw, cash, amt+1);
        })
      })
    })
  })
})
