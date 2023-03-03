// SPDX-License-Identifier: GPL-v3.0
pragma solidity ^0.8.18;

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

    error ErrRange();
    error ErrDone();

    mapping(bytes32=>Config) configs;
    mapping(bytes32=>Observation[2]) obs;
    Feedbase public immutable fb;

    constructor(address _fb) Ward() {
        fb = Feedbase(_fb);
    }
    
    function setConfig(bytes32 tag, Config calldata _config) public _ward_ {
        configs[tag] = _config;
        Observation storage first = obs[tag][0];
        Observation storage last  = obs[tag][1];
        if (_config.range > block.timestamp) revert ErrRange();
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

        (bytes32 spot, uint ttl) = fb.pull(config.source, tag);

        Observation storage first = obs[tag][0];
        Observation storage last  = obs[tag][1];
        uint256 elapsed    = block.timestamp - last.time;
        //uint    capped     = elapsed > config.range ? config.range : elapsed;
        if (elapsed == 0) revert ErrDone();
        // assume spot stayed constant since last observation in window
        uint nexttally = last.tally + last.spot * (elapsed - 1) + uint(spot);

        // assume uniform in old window to calculate pseudo-tally
        // advance twap window by elapsed time
        uint pseudospot;
        uint pseudotally;
        if (elapsed >= config.range) {
            pseudospot = last.spot;
            pseudotally = last.tally + pseudospot * (elapsed - config.range);
        } else {
            pseudospot = (last.tally - first.tally) / config.range;
            pseudotally = first.tally + pseudospot * elapsed;
        }
        obs[tag][0]= Observation(
            pseudotally,
            pseudospot,
            first.time + elapsed
        );
        obs[tag][1] = Observation(nexttally, uint(spot), block.timestamp);

        // push twap, advance ttl from *source feed's* ttl
        if (type(uint).max - ttl < config.ttl) {
            ttl = type(uint).max;
        } else {
            ttl += config.ttl;
        }
        fb.push(tag, bytes32((nexttally - pseudotally) / config.range), ttl);
    }

}
