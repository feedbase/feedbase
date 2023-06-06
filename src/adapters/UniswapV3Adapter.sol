// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.20;

import "../Feedbase.sol";
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

contract UniswapV3Adapter is Ward {
    struct Config {
        address pool;
        uint    range;
        uint    ttl;
        bool    reverse;
    }
    error ErrNoPool();
    error Err0Range();
    Feedbase public immutable feedbase;
    mapping(bytes32=>Config) public configs;
    uint constant RAY = 10 ** 27;
    uint constant X96 = 2 ** 96;
    IUniWrapper public immutable wrap;

    constructor(Feedbase _fb, IUniWrapper _wrap) Ward() {
        feedbase = _fb;
        wrap = _wrap;
    }

    function setConfig(bytes32 tag, Config memory config) public _ward_ {
        configs[tag] = config;
    }

    function look(bytes32 tag) public {
        Config storage config = configs[tag];
        address apool = config.pool;
        if (address(0) == apool) revert ErrNoPool();

        uint32[] memory times = new uint32[](2);
        uint32 range  = uint32(config.range);
        if (range == 0) revert Err0Range();
        times[0] = 0;
        times[1] = range;
        (int56[] memory cumulatives,) = IUniswapV3Pool(apool).observe(times);

        int   delt         = int(cumulatives[0]) - int(cumulatives[1]);
        int24 meantick     = int24(delt / int(uint(range)));
        uint  sqrtPriceX96 = wrap.getSqrtRatioAtTick(meantick);
        uint  priceray     = sqrtPriceX96 ** 2 / X96 * RAY / X96;
        if (config.reverse) {
            priceray = RAY * RAY / priceray;
        }
        feedbase.push(tag, bytes32(priceray), block.timestamp + config.ttl);
    }
}
