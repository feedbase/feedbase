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
  let deployer, ali
  const amt = 1000
  const tag = formatBytes32String('UNI_V3_DAI_USDC')

  before(async () => {
    [deployer, ali] = await ethers.getSigners()

    const FeedbaseFactory = await ethers.getContractFactory('Feedbase')
    fb = await FeedbaseFactory.deploy()

    const UniswapV3AdapterFactory = await ethers.getContractFactory('UniswapV3Adapter')
    adapter = await UniswapV3AdapterFactory.deploy(fb.address)
    debug('UniswapV3Adapter => ' , adapter.address)

    const TokenDeployer = await ethers.getContractFactory('MockToken')
    cash = await TokenDeployer.deploy('CASH', 'CASH')
    usdc = await TokenDeployer.deploy('USDC', 'USD Coin')
    weth = await TokenDeployer.deploy('WETH', 'Wrapped Ether')
    tokens = [usdc, weth]
    // Sort tokens for ordering params in uniswap pool creation
    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    debug('CASH => ', cash.address)
    debug('USDC => ', usdc.address)
    debug('WETH => ', weth.address)

    await cash.mint(ali.address, 10000)
    await cash.approve(fb.address, MaxUint256)

    await usdc.mint(ali.address, 10000)
    await weth.mint(ali.address, 10000)

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
})