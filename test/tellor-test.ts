import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { send, fail, want, snapshot, revert, b32, ray, RAY, wad, WAD } from 'minihat'
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
    const ETHUSD_REQID = "0x83a7f3d48786ac2667503a61e8c415438ed2922eb86a2906e4ee66d9a2ce4992"

    before(async () => {
        signers = await ethers.getSigners();
        [ali, bob, cat] = signers;
        [ALI, BOB, CAT] = [ali.address, bob.address, cat.address]


        const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
        fb = await FeedbaseFactory.deploy()

        const TellorAdapterFactory = await ethers.getContractFactory('TellorAdapter')
        const TELLOR_ADDRESS = "0xD9157453E2668B2fc45b7A803D3FEF3642430cC0"
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
        want(await adapt.configs(tag)).eql([constants.HashZero, constants.Zero])
        await send(adapt.setConfig, tag, config)
        want(await adapt.configs(tag)).eql(config)
    })

    it('look', async () => {
        await send(adapt.setConfig, tag, ["0x83a7f3d48786ac2667503a61e8c415438ed2922eb86a2906e4ee66d9a2ce4992", config[1]])
        await send(adapt.look, tag)
        let [price, ttl] = await fb.pull(adapt.address, tag)
        want(BigNumber.from(price).div(WAD).toNumber()).to.be.closeTo(1500, 500) // 6 decimals
        want(ttl.toNumber()).to.be.lt(Date.now() / 1000) // 6 decimals
    })
})
