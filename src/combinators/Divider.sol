// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.19;

import '../Feedbase.sol';
import { Block } from '../mixin/Block.sol';
import { Ward }  from '../mixin/ward.sol';

contract Divider is Block, Ward {
    struct Config {
        address[] sources;
        bytes32[] tags;
    }
    error ErrShort();
    error ErrMatch();

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

    function read(bytes32 tag) public view override returns (bytes32 val, uint256 minttl) {
        Config storage config = configs[tag];
        uint n = config.sources.length;
        if (config.tags.length != n) revert ErrMatch();
        if (n <= 1) revert ErrShort();

        (val, minttl) = feedbase.pull(
            config.sources[0], config.tags[0]
        );
        uint res = uint(val);
        for (uint i = 1; i < n; i++) {
            (bytes32 opd, uint ttl) = feedbase.pull(
                config.sources[i], config.tags[i]
            );
            if (ttl < minttl) {
                minttl = ttl;
            }
            res = res * precision / uint(opd);
        }
        val = bytes32(res);
    }
}
