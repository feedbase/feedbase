/// SPDX-License-Identifier: AGPL-3.0

// Copyright (C) 2021-2024 halys

pragma solidity ^0.8.19;

import { Feedbase } from "../Feedbase.sol";

contract MockChainlinkAggregator {
    Feedbase public immutable fb;
    address  public immutable src;
    bytes32  public immutable tag;
    uint256  public immutable decimals;

    constructor(Feedbase _fb, address _src, bytes32 _tag, uint _decimals) {
        fb = _fb;
        src = _src;
        tag = _tag;
        decimals = _decimals;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {

        (bytes32 val, uint ttl) = fb.pull(src, tag);

        // only care about val and ttl
        return (0, int(uint(val)), ttl, ttl, 0);
    }
}
