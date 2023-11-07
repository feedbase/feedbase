// SPDX-License-Identifier: GPL-v3.0
pragma solidity ^0.8.19;

import { Read } from "../mixin/Read.sol";
import { Ward } from "../mixin/ward.sol";
import { Feedbase } from "../Feedbase.sol";

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
        uint    precision;
    }
    error ErrNegPrice();

    Feedbase public immutable feedbase;
    mapping(bytes32=>Config)  configs;

    constructor(address _feedbase) Ward() {
        feedbase  = Feedbase(_feedbase);
    }

    function setConfig(bytes32 tag, Config calldata config) public _ward_ {
        configs[tag] = config;
    }

    function getConfig(bytes32 tag) public view returns (Config memory) {
        return configs[tag];
    }

    function read(bytes32 tag) public view override returns (bytes32 val, uint256 minttl) {
        Config storage config = configs[tag];
        AggregatorInterface agg = AggregatorInterface(config.agg);
        (, int256 _res, , uint256 timestamp, ) = agg.latestRoundData();
        if (_res < 0) revert ErrNegPrice();
        uint res = uint(_res);

        // expand/truncate
        uint fromprecision = 10 ** agg.decimals();
        val = bytes32(res * config.precision / fromprecision);

        // handle a feed with updatedAt set to max uint
        unchecked {
            minttl = timestamp + config.ttl;
            if (minttl < timestamp) minttl = type(uint).max;
        }
    }
}
