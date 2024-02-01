// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021-2024 halys

pragma solidity ^0.8.19;

import { Feedbase } from '../Feedbase.sol';
import { Ward } from '../mixin/ward.sol';

interface Read {
    function read(bytes32 tag) external view returns (bytes32 val, uint256 ttl);
}

abstract contract Block is Read, Ward {
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
    
    function setConfig(bytes32 tag, Config calldata _config)
      external payable _ward_ {
        uint n = _config.sources.length;
        if (n < 2) revert ErrShort();
        if (_config.tags.length != n) revert ErrMatch();
        configs[tag] = _config;
    }

    // can't have public getter for struct of dynamic arrays
    function getConfig(bytes32 tag) external view returns (Config memory) {
        return configs[tag];
    }
}
