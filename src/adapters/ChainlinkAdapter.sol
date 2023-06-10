// SPDX-License-Identifier: GPL-v3.0
pragma solidity ^0.8.19;

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

contract ChainlinkAdapter is Ward {
    struct Config {
        address agg;
        uint    ttl;
        uint    precision;
    }
    error ErrNegPrice();

    Feedbase public fb;
    mapping(bytes32=>Config) public configs;

    constructor(address _fb) Ward() {
        fb  = Feedbase(_fb);
    }

    function setConfig(bytes32 tag, Config calldata config) public _ward_ {
        configs[tag] = config;
    }

    function look(bytes32 tag) public {
        Config storage config = configs[tag];
        AggregatorInterface agg = AggregatorInterface(config.agg);
        (, int256 _res, , uint256 timestamp, ) = agg.latestRoundData();
        if (_res < 0) revert ErrNegPrice();
        uint res = uint(_res);

        // expand/truncate
        uint fromprecision = 10 ** agg.decimals();
        res = res * config.precision / fromprecision;

        // from chainlink's timestamp
        fb.push(tag, bytes32(res), timestamp + config.ttl);
    }
}
