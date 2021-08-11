const debug = require('debug')('feedbase:test')
const want = require('chai').expect

const BN = require('bn.js')

const Feedbase = require('../artifacts/contracts/Feedbase.sol/Feedbase.json')
const OracleFactory = require('../artifacts/contracts/Oracle.sol/OracleFactory.json')
const Oracle = require('../artifacts/contracts/Oracle.sol/Oracle.json')

const Token = require('../artifacts/contracts/MockToken.sol/MockToken.json')

const { ethers, network } = require('hardhat')

let fb;
let cash;
let signers;

let TAG = Buffer.from("USDETH" + " ".repeat(26))

let use = (n) => {
  let signer = signers[n];
  debug(`using ${n} ${signer.address}`)

  cash = cash.connect(signer);
  fb = fb.connect(signer);
}

describe('pay flow', ()=>{

  beforeEach(async () => {
    signers = await ethers.getSigners();

    const FeedbaseDeployer = await ethers.getContractFactory("Feedbase");
    const TokenDeployer = await ethers.getContractFactory("MockToken");
    fb = await FeedbaseDeployer.deploy();
    cash = await TokenDeployer.deploy("CASH");

    use(1);

    const tx_mint = await cash.functions['mint(uint256)'](1000);
    await tx_mint.wait();
    const tx_approve = await cash.functions['approve(address)'](fb.address);
    await tx_approve.wait();

    use(0);

    const tx_setCost = await fb.setCost(cash.address, TAG, 100);
    await tx_setCost.wait();
  });

  it('topUp request push', async () => {
    use(1)

    const bal = await cash.balanceOf(signers[1].address);
    want(bal.toNumber()).equals(1000);

    const tx_topUp = await fb.topUp(cash.address, TAG, 500);
    await tx_topUp.wait();

    const fbal0 = await fb.feedDemand(cash.address, signers[1].address, TAG);
    want(fbal0.toNumber()).equals(500);
    debug(`fbal0 ${fbal0}`);
    const bal2 = await cash.balanceOf(signers[1].address);
    want(bal2.toNumber()).equals(500);

    const tx_request = await fb.request(cash.address, signers[0].address, TAG, 100);
    await tx_request.wait();

    const fbal1 = await fb.feedDemand(cash.address, signers[1].address, TAG);
    want(fbal1.toNumber()).equals(400);
    const fbal2 = await fb.feedDemand(cash.address, signers[0].address, TAG);
    want(fbal2.toNumber()).equals(100);

    use(0)

    let seq = 1;
    let sec = Math.floor(Date.now() / 1000);
    let ttl = 10**10;
    let val = Buffer.from('ff'.repeat(32), 'hex')

    const tx_push = await fb.pushPaid(cash.address, TAG, ttl, val);
    await tx_push.wait()

    const fbal3 = await fb.feedDemand(cash.address, signers[0].address, TAG);
    want(fbal3.toNumber()).equals(0);
    const fees = await fb.feedCollected(cash.address, signers[0].address, TAG);
    want(fees.toNumber()).equals(100);

    const pre = await cash.balanceOf(signers[0].address);
    const tx_cashOut = await fb.cashOut(cash.address, TAG, 100);
    await tx_cashOut.wait();
    const post = await cash.balanceOf(signers[0].address);
    want(post.sub(pre).toNumber()).equals(100);
    const fees2 = await fb.feedCollected(cash.address, signers[0].address, TAG);
    want(fees2.toNumber()).equals(0);
    
  });

});

