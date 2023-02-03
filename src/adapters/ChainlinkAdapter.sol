// SPDX-License-Identifier: GPL-v3.0
pragma solidity 0.8.17;

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
        uint    range;
        uint    ttl;
        uint    precision;
    }
    Feedbase public fb;
    AggregatorInterface public agg;

    mapping(bytes32=>Config) configs;

    constructor(address _fb, address _agg) Ward() {
        agg = AggregatorInterface(_agg);
        fb  = Feedbase(_fb);
    }

    function setConfig(bytes32 tag, Config calldata config) public _ward_ {
        configs[tag] = config;
    }

    function look(bytes32 tag) public {
        (, int256 _res, , uint256 timestamp, ) = agg.latestRoundData();
        require(_res >= 0, "negative price");
        uint res = uint(_res);

        // expand/truncate
        Config storage config = configs[tag];
        uint fromprecision = agg.decimals();
        uint toprecision = config.precision;
        if (toprecision > fromprecision) {
            res *= toprecision / fromprecision;
        } else {
            res *= fromprecision / toprecision;
        }

        // from chainlink's timestamp
        fb.push(tag, bytes32(uint(res)), timestamp + config.ttl);
    }
}
