// SPDX-License-Identifier: GPL-v3.0
pragma solidity ^0.8.17;

import '../Feedbase.sol';
import { Ward } from '../mixin/ward.sol';

contract TWAP is Ward {
    struct Config {
        address source;
        uint    range;
        uint    ttl;
    }

    struct Observation {
        uint tally;
        uint spot;
        uint time;
    }

    mapping(bytes32=>Config) configs;

    // observation, but not in a struct because
    // solidity won't allow it
    mapping(bytes32=>Observation[2]) _obs;

    Feedbase  public fb;

    constructor(address _fb) Ward() {
        fb = Feedbase(_fb);
    }
    
    function setConfig(bytes32 tag, Config calldata _config) public _ward_ {
        configs[tag] = _config;
        Observation storage first = _obs[tag][0];
        Observation storage last  = _obs[tag][1];
        first.time = block.timestamp - _config.range;
        last.time = block.timestamp;
    }

    // can't have a public variable
    function getConfig(bytes32 tag) public view returns (Config memory) {
        return configs[tag];
    }

    // modified from reflexer ChainlinkTWAP
    // https://github.com/reflexer-labs/geb-chainlink-median/blob/master/src/ChainlinkTWAP.sol
    // GPL3
    function poke(bytes32 tag) external {
        Config storage config = configs[tag];

        // ttl doesn't matter too much, just get a delayed result
        (bytes32 _spot,) = fb.pull(config.source, tag);
        uint spot = uint(_spot);
        require(spot > 0, "TWAP/invalid-feed-result");

        Observation storage first = _obs[tag][0];
        Observation storage last  = _obs[tag][1];
        uint256 elapsed = block.timestamp - last.time;
        require(elapsed > 0, "TWAP/no-time-elapsed");
        // assume spot stayed constant since last observation in window
        uint nexttally = last.tally + last.spot * (block.timestamp - last.time - 1) + spot;

        // assume uniform in old window to calculate pseudo-tally
        // advance twap window by elapsed time
        uint pseudospot = (last.tally - first.tally) / config.range;
        uint pseudotally = first.tally + pseudospot * elapsed;
        _obs[tag][0]= Observation(
            pseudotally,
            pseudospot,
            first.time + elapsed
        );
        _obs[tag][1] = Observation(nexttally, spot, block.timestamp);

        // push twap
        fb.push(tag, bytes32((nexttally - pseudotally) / config.range), config.ttl);
    }

}
