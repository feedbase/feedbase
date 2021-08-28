const debug = require('debug')('feedbase:test')
const want = require('chai').expect

const BN = require('bn.js')

const Feedbase = require('../artifacts/contracts/Feedbase.sol/Feedbase.json')
const OracleFactory = require('../artifacts/contracts/Oracle.sol/OracleFactory.json')
const Oracle = require('../artifacts/contracts/Oracle.sol/Oracle.json')

const { ethers, network } = require('hardhat')

const { makeUpdateDigest } = require('../message.js');

describe('feedbase', ()=>{
  it('basics', async function() {
    let FeedbaseFactory = await ethers.getContractFactory("Feedbase")
    const fb = await FeedbaseFactory.deploy() 
  });

  it('oracle relay', async function() {
    const { chainId } = network.config;
    debug("chainId: ", chainId);

    let signers = await ethers.getSigners();
    //debug(signers[0])
    let FeedbaseFactory = await ethers.getContractFactory("Feedbase")
    const fb = await FeedbaseFactory.deploy() 
    let OracleFactoryFactory = await ethers.getContractFactory("OracleFactory");
    const factory = await OracleFactoryFactory.deploy(fb.address);

    const tx = await factory.build();
    //debug('create', tx)
    const res = await tx.wait();
    const oracleAddr = res.events[0].args[0]

    const oracle = await new ethers.Contract(oracleAddr, Oracle.abi, signers[0]);
    const tx2 = await oracle.setSigner(signers[0].address, 1000000000000);
    await tx2.wait()

    const sttl = await oracle.signerTTL(signers[0].address);
    debug(`sttl: ${sttl}`)

    const oracleChainId = await oracle.chainId();
    debug(`oracleChainId: ${oracleChainId}`);
    want(chainId).equal(oracleChainId);
    

    const tag = Buffer.from('USDETH'.padStart(32, '\0'));
    const seq = 1;
    const sec = Math.floor(Date.now() / 1000);
    const ttl = 10000000000000
    const val = Buffer.from('11'.repeat(32), 'hex');
    debug(tag, seq, sec, ttl, val);
    const digest = makeUpdateDigest({
      tag, 
      val: val,
      seq: seq,
      sec: sec,
      ttl: ttl,
      chainId: chainId,
      receiver: oracle.address
    });
    debug(`digest: ${Buffer.from(digest).toString('hex')}`);

    const signature = await signers[0].signMessage(digest);
    debug(`signature ${signature}`)
    const sig = ethers.utils.splitSignature(signature);
    //debug(sig);
    const tx3 = await oracle.submit(tag, seq, sec, ttl, val, sig.v, sig.r, sig.s);
    
  });

  it("ttl on read", async function() {
    const signers = await ethers.getSigners();
    //debug(signers[0]);

    const FeedbaseFactory = await ethers.getContractFactory("Feedbase");
    const fb = await FeedbaseFactory.deploy();

    const tag = Buffer.from('USDETH'.padStart(32, '\0'));
    const seq = 1;
    const sec = Math.floor(Date.now() / 1000);
    const ttl = 10000000000000
    const val = Buffer.from('11'.repeat(32), 'hex');
    debug(tag, seq, sec, ttl, val);

    const push = await fb.push(tag, ttl, val);
    const read = await fb.read(signers[0].address, tag);
    debug(`read result ${read}`);

    want(read.ttl).equal(ttl);
    want(read.val).equal("0x" + val.toString("hex"));
  })
});
