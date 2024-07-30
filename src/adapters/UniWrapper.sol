// SPDX-License-Identifier: AGPL-3.0

// Copyright (C) 2024 Free Software Foundation, in loving memory of Nikolai

pragma solidity 0.7.6;
import { PoolAddress, INonfungiblePositionManager, PositionValue } from '@uniswap/v3-periphery/contracts/libraries/PositionValue.sol';
import { TickMath } from '@uniswap/v3-core/contracts/libraries/TickMath.sol';

// some uniswapv3 libraries use earlier solc version
// need this to integrate with solc 0.8
contract UniWrapper {
    // total of token0 and token1 this pair is worth
    function total(INonfungiblePositionManager nfpm, uint tokenId, uint160 sqrtPriceX96)
      external view returns (uint amount0, uint amount1) {
        return PositionValue.total(nfpm, tokenId, sqrtPriceX96);
    }

    // each tuple (token0, token1, fee) has a single pool address
    function computeAddress(address factory, address t0, address t1, uint24 fee)
      external pure returns (address) {
        return PoolAddress.computeAddress(factory, PoolAddress.getPoolKey(t0, t1, fee));
    }

    // q64.96 sqrt(amt_token0/amt_token1)
    function getSqrtRatioAtTick(int24 tick) external pure returns (uint) {
        return TickMath.getSqrtRatioAtTick(tick);
    }
}
