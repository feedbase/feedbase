// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.18;

import '../Feedbase.sol';
import { Ward } from '../mixin/ward.sol';

contract Divider is Ward {
    struct Config {
        address[] sources;
        bytes32[] tags;
    }

    mapping(bytes32=>Config) configs;
    Feedbase  public feedbase;
    uint immutable precision;

    constructor(address fb, uint _precision) Ward() {
        feedbase = Feedbase(fb);
        precision = _precision;
    }
    
    function setConfig(bytes32 tag, Config calldata _config) public _ward_ {
        configs[tag] = _config;
    }

    // can't have a public variable
    function getConfig(bytes32 tag) public view returns (Config memory) {
        return configs[tag];
    }

    function poke(bytes32 tag) public {
        Config storage config = configs[tag];
        uint n = config.sources.length;
        require(config.tags.length == n, 'sources.length != tags.length');
        require(n > 1, 'not enough operands to divide');

        (bytes32 _res, uint minttl) = feedbase.pull(
            config.sources[0], config.tags[0]
        );
        uint res = uint(_res);
        for (uint i = 1; i < n; i++) {
            (bytes32 opd, uint ttl) = feedbase.pull(
                config.sources[i], config.tags[i]
            );
            if (ttl < minttl) {
                minttl = ttl;
            }
            res = res * precision / uint(opd);
        }

        feedbase.push(tag, bytes32(res), minttl);
    }
}
