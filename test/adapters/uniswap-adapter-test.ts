import * as hh from 'hardhat'
import { ethers } from 'hardhat'
import { Contract } from 'hardhat/types'
import { fail, revert, snapshot, want } from 'minihat'
import { FeeAmount } from '@uniswap/v3-sdk'
import UniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

const debug = require('debug')('feedbase:test')
const { constants, BigNumber, utils } = ethers
const { MaxUint256 } = constants
const { formatBytes32String, parseEther, parseBytes32String } = utils

describe('UniswapV3Adapter', () => {
  let tokens, cash, usdc, weth
  let fb, adapter, pool, POOL
  let nftDescriptor, nonFungiblePositionManager, tokenDescriptor, uniswapFactory
  let deployer, ali, bob
  let DEPLOYER, ALI, BOB
  let CASH
  const tag = formatBytes32String('UNI_V3_DAI_USDC')

  before(async () => {
    ;[ali, bob, deployer] = await ethers.getSigners()
    DEPLOYER = deployer.address
    ALI = ali.address
    BOB = bob.address

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const UniswapV3AdapterFactory = await ethers.getContractFactory('UniswapV3Adapter')
    adapter = await UniswapV3AdapterFactory.deploy(fb.address)
    debug('UniswapV3Adapter => ' , adapter.address)

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')
    usdc = await TokenDeployer.deploy('USDC', 'USD Coin')
    weth = await TokenDeployer.deploy('WETH', 'Wrapped Ether')
    
    CASH = cash.address

    tokens = [usdc, weth]
    // Sort tokens for ordering params in uniswap pool creation
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    debug('CASH => ', cash.address)
    debug('USDC => ', usdc.address)
    debug('WETH => ', weth.address)

    await cash.mint(ALI, 10000)
    await cash.approve(adapter.address, MaxUint256)

    await usdc.mint(ALI, 10000)
    await weth.mint(ALI, 10000)

    // Setup Mock Uniswap Pool
    const UniswapV3FactoryFactory = await ethers.getContractFactory(
      UniswapV3Factory.abi,
      UniswapV3Factory.bytecode,
      deployer
    )
    uniswapFactory = await UniswapV3FactoryFactory.deploy()
    debug('UniswapV3Factory => ', uniswapFactory.address)
    
    // Create a new Uniswap pool and retrieve the pool's address
    const tx = await uniswapFactory.createPool(usdc.address, weth.address, FeeAmount.MEDIUM)
    const { events } = await tx.wait()
    // args => token0, token1, fee, tickSpacing, pool
    const [{ args }] = events
    POOL = args.pool

    pool = new ethers.Contract(
      POOL, 
      UniswapV3Pool.abi,
      deployer
    )
    debug('UniswapV3Pool => ', POOL)

    // Initialize the pool
    const val = BigNumber.from(1)
    .div(1)
    // .sqrt()
    .mul(new BigNumber.from(2).pow(96))
    // .integerValue(3)
    .toString()
    debug('val => ', val)
    await pool.initialize(val)

    await snapshot(hh)
  })

  beforeEach(async () => {
    await revert(hh)
  })

  it('basic', async () => {
    debug('USDC_WETH_POOL:')
    const liquidity = await pool.liquidity()
    debug('   liquidity => ', liquidity.toString())
    let tickSpacing = await pool.tickSpacing()
    debug('   tickSpacing => ', tickSpacing)
    const fee = await pool.fee()
    debug('   fee => ', fee)
    const maxLiquidityPerTick = await pool.maxLiquidityPerTick()
    debug('   maxLiquidityPerTick => ', maxLiquidityPerTick.toString())
    let slot = await pool.slot0()
    const { sqrtPriceX96, tick } = slot
    // debug('slot => ', slot)
    debug('   sqrtPriceX96 => ', sqrtPriceX96.toString())
    debug('   tick => ', tick)

    // const mint = await pool.mint(ali.address, TickMath.MIN_TICK, TickMath.MAX_TICK, 1000, [])
    // debug('mint => ', mint)
  })

  describe('deposit', async () => {
    const amt = 1000

    beforeEach(async () => {
      const before = await adapter.balances(CASH, ALI)
      want(before.toNumber()).to.eql(0)
    })

    it('success - for self', async () => {
      await adapter.deposit(CASH, ALI, amt)
      const res = await Promise.all([
        await adapter.balances(CASH, ALI),
        await fb.balances(CASH, adapter.address)
      ])
      const bals = res.map(x => x.toNumber())
      want(bals).to.eql([amt, amt])
    })

    it('success - for other', async () => {
      await adapter.deposit(CASH, BOB, amt)
      const res = await Promise.all([
        await adapter.balances(CASH, BOB),
        await fb.balances(CASH, adapter.address)
      ])
      const bals = res.map(x => x.toNumber())
      want(bals).to.eql([amt, amt])
    })

    it('fail - erc20 transfer', async () => {
      const con = adapter.connect(bob)
      await fail('', con.deposit, CASH, BOB, amt)
    })
  })

  describe('withdraw', async () => {
    const amt = 1000
    const withdraw = 700

    const getBalances = async (usr) => (await Promise.all([
      await adapter.balances(CASH, usr),
      await fb.balances(CASH, adapter.address)
    ])).map(x => x.toNumber())

    beforeEach(async () => {
      await adapter.deposit(CASH, ALI, amt)
      const before = await getBalances(ALI)
      want(before).to.eql([amt, amt])
    })

    it('success - to self', async () => {
      await adapter.withdraw(CASH, ALI, withdraw)
      const after = await getBalances(ALI)
      want(after).to.eql([amt - withdraw, amt - withdraw])
    })

    it('success - to other', async () => {
      const before = await getBalances(BOB)
      want(before).to.eql([0, amt])
      want((await cash.balanceOf(BOB)).toNumber()).to.eql(0)
      await adapter.withdraw(CASH, BOB, withdraw)
      want(await getBalances(ALI)).to.eql([amt - withdraw, amt - withdraw])
      want((await cash.balanceOf(BOB)).toNumber()).to.eql(withdraw)
    })

    it('fail - underflow', async () => {
      await fail('underflow', adapter.withdraw, CASH, BOB, amt + 1)
    })
  })

  describe('setCost', async () => {
    it('success', async () => {

    })

    it('fail - not owner', async () => {

    })

    it('fail - cash address', async () => {

    })
  })

  describe('getCost', async () => {
    it('success', async () => {

    })
  })

  describe('setOwner', async () => {
    it('success', async () => {

    })

    it('fail - not owner', async () => {
      
    })
  })
})