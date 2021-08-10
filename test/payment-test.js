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

    const tx_config = await fb.config(TAG, cash.address, 100, '');
    await tx_config.wait();
  });

  it('topUp request push', async () => {
    use(1)

    const bal = await cash.balanceOf(signers[1].address);
    want(bal.toNumber()).equals(1000);

    // NOTE need for this is shit api
    const tx_config = await fb.config(TAG, cash.address, 0, '');
    await tx_config.wait();

    const tx_topUp = await fb.topUp(TAG, 500);
    await tx_topUp.wait();

    const bal2 = await cash.balanceOf(signers[1].address);
    want(bal2.toNumber()).equals(500);

    const tx_request = await fb.request(signers[0].address, TAG, 100);
    await tx_request.wait();

    use(0)

    let seq = 1;
    let sec = Math.floor(Date.now() / 1000);
    let ttl = 10**10;
    let val = Buffer.from('ff'.repeat(32), 'hex')
    const tx_push = await fb.push(TAG, seq, sec, ttl, val);
    await tx_push.wait()

    const tx_cashout = await fb.cashout(TAG, 100);
    await tx_cashout.wait();
    
  });

});

