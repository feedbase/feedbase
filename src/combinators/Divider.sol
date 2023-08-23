// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.19;

import { Block } from '../mixin/Read.sol';

contract Divider is Block {
    constructor(address fb) Block(fb) {}

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
