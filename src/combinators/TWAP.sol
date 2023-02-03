// SPDX-License-Identifier: GPL-v3.0
pragma solidity ^0.8.17;

import '../Feedbase.sol';
import { Ward } from '../mixin/ward.sol';

contract TWAP is Ward {
    struct Config {
        address source;
        uint    range;
        uint    granularity;
        uint    ttl;
    }

    struct Cache {
        uint first;
        uint last;
    }

    struct Observation {
        uint tally;
        uint spot;
        uint time;
    }

    mapping(bytes32=>Config) configs;

    // observation, but not in a struct because
    // solidity won't allow it
    mapping(bytes32=>Observation[]) _obs;

    mapping(bytes32=>Cache) caches;

    Feedbase  public fb;
    uint immutable precision;

    constructor(address _fb, uint _precision) Ward() {
        fb = Feedbase(_fb);
        precision = _precision;
    }
    
    function setConfig(bytes32 tag, Config calldata _config) public _ward_ {
        configs[tag] = _config;
        uint granularity = _config.granularity;
        Observation[] storage obs = _obs[tag];
        uint len = obs.length;
        if (len < granularity) {
            Observation memory nil = Observation(0, 0, 0);
            for (len = obs.length; len < granularity; len++) {
                obs.push(nil);
            }
        } else {
            for (len = obs.length; len > granularity; len--) {
                obs.pop();
            }
        }
        delete caches[tag];
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

        uint period = config.range / config.granularity;
        // ttl doesn't matter too much, just get a delayed result
        (bytes32 _spot,) = fb.pull(configs[tag].source, tag);
        uint spot = uint(_spot);

        require(spot > 0, "TWAP/invalid-feed-result");

        uint first = caches[tag].first;
        uint last = caches[tag].last;
        Observation storage firstob = _obs[tag][first];
        Observation storage lastob  = _obs[tag][last];
        uint256 elapsed = (0 == first && 0 == last) ?
            period : block.timestamp - lastob.time;
        require(elapsed > period, "TWAP/wait-more");
        // assume spot stayed constant since last observation in window
        uint nexttally = lastob.tally + lastob.spot * (block.timestamp - lastob.time) + spot;

        // push twap
        fb.push(tag, bytes32(nexttally / (block.timestamp - firstob.time)), config.ttl);

        // advance twap window by number of periods passed
        uint advance = elapsed / period;
        Cache storage cache = caches[tag];
        cache.first = (first + advance) % config.granularity;
        cache.last = (last + advance) % config.granularity;
        _obs[tag][cache.last] = Observation(nexttally, spot, block.timestamp);

        // very cool trick because the new first might have invalid data
        // assume uniform in old window to calculate observation
        _obs[tag][cache.first] = Observation(
            firstob.tally + (lastob.tally - firstob.tally) * advance / (advance + config.range),
            (lastob.tally - firstob.tally) / config.range,
            (lastob.time - firstob.time) * advance / (advance + config.range)
        );
    }

}
