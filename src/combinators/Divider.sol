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
    mapping(bytes32=>Config) configs;

    error ErrMatch();
    error ErrShort();

    Feedbase public immutable feedbase;
    uint256 internal constant RAY = 10 ** 27;

    constructor(address fb) Ward() {
        feedbase = Feedbase(fb);
    }
    
    function setConfig(bytes32 tag, Config calldata _config) public _ward_ {
        uint n = _config.sources.length;
        if (n < 2) revert ErrShort();
        if (_config.tags.length != n) revert ErrMatch();
        configs[tag] = _config;
    }

    // can't have public getter for struct of dynamic arrays
    function getConfig(bytes32 tag) public view returns (Config memory) {
        return configs[tag];
    }

    function read(bytes32 tag) public view override returns (bytes32 val, uint256 minttl) {
        Config storage config = configs[tag];
        uint n = config.sources.length;
        (val, minttl) = feedbase.pull(config.sources[0], config.tags[0]);
        uint res = uint(val);
        for (uint i = 1; i < n;) {
            (bytes32 div, uint ttl) = feedbase.pull(config.sources[i], config.tags[i]);
            if (ttl < minttl) minttl = ttl;
            res = res * RAY / uint(div);
            unchecked{ ++i; }
        }
        val = bytes32(res);
    }
}
