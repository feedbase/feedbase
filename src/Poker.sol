// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2024 Free Software Foundation, in memoriam of Nikolai Mushegian

pragma solidity ^0.8.19;

import { Ward } from './mixin/ward.sol';

interface Combinator {
    function poke(bytes32) external;
}

contract Poker is Ward {
    struct Config {
        address[] combinators;
        bytes32[] combinatortags;
    }

    mapping(bytes32 tag => Config) configs;
    error ErrNoConfig();

    function getConfig(bytes32 tag) external view returns (Config memory) {
        return configs[tag];
    }

    function setConfig(bytes32 tag, Config memory _config) external payable _ward_ {
        configs[tag].combinators = _config.combinators;
        configs[tag].combinatortags = _config.combinatortags;
    }

    function poke(bytes32 tag) external payable {
        Config storage config = configs[tag];
        if (config.combinators.length == 0) revert ErrNoConfig();
        for (uint i = 0; i < config.combinators.length; i++) {
            Combinator(config.combinators[i]).poke(config.combinatortags[i]);
        }
    }
}
