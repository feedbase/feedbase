// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.19;

import "../mixin/Read.sol";
import { Ward } from '../mixin/ward.sol';

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos) external view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        );
}

interface IUniWrapper {
    function getSqrtRatioAtTick(int24 tick) external view returns (uint);
}

contract UniswapV3Adapter is Read, Ward {
    struct Config {
        address pool;
        uint    range;
        uint    ttl;
        bool    reverse;
    }

    error ErrNoPool();
    error Err0Range();

    IUniWrapper public immutable wrap;
    mapping(bytes32=>Config)     configs;

    uint constant RAY = 10 ** 27;
    uint constant X96 = 2 ** 96;

    constructor(IUniWrapper _wrap) Ward() {
        wrap = _wrap;
    }

    function setConfig(bytes32 tag, Config memory config) external payable _ward_ {
        configs[tag] = config;
    }

    function getConfig(bytes32 tag) external view returns (Config memory config) {
        return configs[tag];
    }

    function read(bytes32 tag)
      external view override returns (bytes32 val, uint256 ttl) {
        Config storage config = configs[tag];
        uint32         range  = uint32(config.range);
        address        apool  = config.pool;
        if (address(0) == apool) revert ErrNoPool();

        // array of timestamps to get cumulative tick data
        // need the latest and the window's start
        uint32[] memory times = new uint32[](2);
        if (range == 0) revert Err0Range();
        times[0] = 0;
        times[1] = range;

        // sum of tick data from (last_stamp, last_stamp - range)
        (int56[] memory cumulatives,) = IUniswapV3Pool(apool).observe(times);

        // mean tick
        int   delt         = int(cumulatives[0]) - int(cumulatives[1]);
        int24 meantick     = int24(delt / int(uint(range)));

        // mean tick's corresponding price
        uint  sqrtPriceX96 = wrap.getSqrtRatioAtTick(meantick);
        uint  priceray     = sqrtPriceX96 ** 2 / X96 * RAY / X96;

        if (config.reverse) {
            priceray = RAY * RAY / priceray;
        }

        val = bytes32(priceray);

        unchecked {
            ttl = block.timestamp + config.ttl;
            if (ttl < block.timestamp) ttl = type(uint).max;
        }
    }
}
