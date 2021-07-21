const debug = require('debug')('feedbase:test')
const want = require('chai').expect

const Feedbase = require('../artifacts/contracts/Feedbase.sol/Feedbase.json')
const OracleFactory = require('../artifacts/contracts/Oracle.sol/OracleFactory.json')
const Oracle = require('../artifacts/contracts/Oracle.sol/Oracle.json')

const { ethers, waffle } = require('hardhat')

const { makeUpdateDigest } = require('../message.js');

describe('feedbase', ()=>{
  it('basics', async ()=>{
    let FeedbaseFactory = await ethers.getContractFactory("Feedbase")
    //debug(FeedbaseFactory);
    const fb = await FeedbaseFactory.deploy() 
    //debug(fb);
  });

  it('oracle relay', async()=>{
    let signers = await ethers.getSigners();
    debug(signers[0])
    let FeedbaseFactory = await ethers.getContractFactory("Feedbase")
    const fb = await FeedbaseFactory.deploy() 
    let OracleFactoryFactory = await ethers.getContractFactory("OracleFactory");
    const factory = await OracleFactoryFactory.deploy(fb.address, 1);
    //debug(factory);

    const tx = await factory.create();
    debug('create', tx)
    const res = await tx.wait();
//    debug(res);
//    debug(res.events[0].args[0]);
    const oracleAddr = res.events[0].args[0]

    const oracle = await new ethers.Contract(oracleAddr, Oracle.abi, signers[0]);
//    debug(oracle);
    const tx2 = await oracle.setSigner(signers[0].address, 1000000000000);
    await tx2.wait()

    const sttl = await oracle.signerTTL(signers[0].address);
    debug(`sttl: ${sttl}`)

    const tag = Buffer.from('USDETH'.padStart(32, '\0'));
    const val = Buffer.from('11'.repeat(32), 'hex');
    const ttl = 10000000000000;
    const digest = makeUpdateDigest({
      tag, 
      val,
      ttl,
      chainId: "1",
      receiver: oracle.address
    });
    debug(`digest: ${Buffer.from(digest).toString('hex')}`);

    const signature = await signers[0].signMessage(digest);
    debug(signature)
    const sig = ethers.utils.splitSignature(signature);
    debug(sig);
    const tx3 = await oracle.submit(tag, val, ttl, sig.v, sig.r, sig.s);
    
  });
});
