/// SPDX-License-Identifier: AGPL-3.0

// Copyright (C) 2021-2023 halys

pragma solidity ^0.8.0;

import { Ward } from './mixin/ward.sol';

interface Combinator {
    function poke(bytes32) external;
}

// looker and poker
contract Ploker is Ward {
    struct Config {
        address[] combinators;
        bytes32[] combinatortags;
    }

    mapping(bytes32 tag => Config) configs;
    error ErrNoConfig();

    function getConfig(bytes32 tag) view public returns (Config memory) {
        return configs[tag];
    }

    function setConfig(bytes32 tag, Config memory _config) _ward_ public {
        configs[tag].combinators = _config.combinators;
        configs[tag].combinatortags = _config.combinatortags;
    }

    function ploke(bytes32 tag) public {
        Config storage config = configs[tag];
        if (config.combinators.length == 0) revert ErrNoConfig();
        for (uint i = 0; i < config.combinators.length; i++) {
            Combinator(config.combinators[i]).poke(config.combinatortags[i]);
        }
    }
}
