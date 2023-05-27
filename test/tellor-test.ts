import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, ray, RAY } from 'minihat'
const { constants, BigNumber } = ethers

const debug = require('debug')('feedbase:test')

let fb
let signers
let oracle

describe('tellor', () => {
    const XAU_USD_AGG_ADDR = "0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6"
    let tag, seq, sec, ttl, val
    let ali, bob, cat
    let ALI, BOB, CAT
    let adapt
    let config
    let precision
    const ETHUSD_REQID = constants.One
    before(async () => {
        signers = await ethers.getSigners();
        [ali, bob, cat] = signers;
        [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]


        const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
        fb = await FeedbaseFactory.deploy()

        const TellorAdapterFactory = await ethers.getContractFactory('TellorAdapter')
        const TELLOR_ADDRESS = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
        adapt = await TellorAdapterFactory.deploy(fb.address, TELLOR_ADDRESS)

        await snapshot(hh)
    })
    beforeEach(async () => {
        await revert(hh)
        tag = b32('eth:usd')
        config = [ETHUSD_REQID, constants.One.mul(1000)]
    })

    it('ward', async function () {
        want(await adapt.wards(ALI)).equal(true);
        want(await adapt.wards(BOB)).equal(false);
        want(await adapt.wards(CAT)).equal(false);
        await fail('ErrWard', adapt.connect(bob).ward, CAT, true);
        await fail('ErrWard', adapt.connect(cat).ward, CAT, true);

        await send(adapt.ward, BOB, true);
        await send(adapt.connect(bob).setConfig, b32('hello'), config)

        await send(adapt.ward, BOB, false)
        await fail('ErrWard', adapt.connect(bob).setConfig, b32('hello'), config)
        await fail('ErrWard', adapt.connect(bob).ward, CAT, false)
    })



    it('setConfig', async () => {
        want(await adapt.configs(tag)).eql([constants.Zero, constants.Zero])
        await send(adapt.setConfig, tag, config)
        want(await adapt.configs(tag)).eql(config)
    })

    it('look', async () => {
        await send(adapt.setConfig, tag, config)
        await send(adapt.look, tag)
        let [price, ttl] = await fb.pull(adapt.address, tag)
        want(BigNumber.from(price).toNumber()).to.be.closeTo(1500000000, 500000000) // 6 decimals
        want(ttl.toNumber()).to.be.lt(Date.now() / 1000) // 6 decimals
    })
})
