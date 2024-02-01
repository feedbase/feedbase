// SPDX-License-Identifier: GPL-v3.0
// Copyright (C) 2021-2024 halys
pragma solidity ^0.8.19;

import { Read } from "../mixin/Read.sol";
import { Ward } from "../mixin/ward.sol";

interface AggregatorInterface {
    function decimals() external view returns (uint8);
    function latestRoundData()
      external
      view
      returns (
        uint256 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint256 answeredInRound
      );
}

contract ChainlinkAdapter is Read, Ward {
    struct Config {
        address agg;
        uint    ttl;
    }
    error ErrNegPrice();

    mapping(bytes32=>Config) configs;

    uint constant RAY = 10 ** 27;

    function setConfig(bytes32 tag, Config calldata config)
      external payable _ward_ {
        configs[tag] = config;
    }

    function getConfig(bytes32 tag)
      external view returns (Config memory) {
        return configs[tag];
    }

    function read(bytes32 tag)
      external view override returns (bytes32 val, uint256 ttl) {
        Config storage config   = configs[tag];
        AggregatorInterface agg = AggregatorInterface(config.agg);

        (, int256 _res, , uint256 timestamp, ) = agg.latestRoundData();
        if (_res < 0) revert ErrNegPrice();
        uint res = uint(_res);

        // expand/truncate
        val = bytes32(res * RAY / (10 ** agg.decimals()));

        // handle a feed with updatedAt set to max uint
        unchecked {
            ttl = timestamp + config.ttl;
            if (ttl < timestamp) ttl = type(uint).max;
        }
    }
}
