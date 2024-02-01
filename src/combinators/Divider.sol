// SPDX-License-Identifier: GPL-v3.0
// Copyright (C) 2021-2024 halys

pragma solidity ^0.8.19;

import { Block } from '../mixin/Read.sol';

contract Divider is Block {
    constructor(address fb) Block(fb) {}

    function read(bytes32 tag)
      external view override returns (bytes32 val, uint256 minttl)
    {
        Config storage config = configs[tag];

        // read numerator
        (val, minttl) = feedbase.pull(config.sources[0], config.tags[0]);
        uint res      = uint(val);

        // read denominators and divide res (ray precision)
        uint n = config.sources.length;
        for (uint i = 1; i < n;) {
            (bytes32 div, uint ttl) = feedbase.pull(config.sources[i], config.tags[i]);
            res = res * RAY / uint(div);
            unchecked{ ++i; }

            if (ttl < minttl) minttl = ttl;
        }

        val = bytes32(res);
    }
}
