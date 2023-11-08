// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.19;

import '../Feedbase.sol';
import { Ward } from '../mixin/ward.sol';

contract Medianizer is Ward {
    error ErrQuorum();
    error ErrZeroQuorum();
    error ErrConfig();

    struct Config {
        address[] srcs;
        bytes32[] tags;
        uint      quorum;
    }

    Feedbase public immutable feedbase;
    mapping(bytes32 dtag => Config) configs;

    constructor(address fb) Ward() {
        feedbase = Feedbase(fb);
    }

    function setConfig(bytes32 dtag, Config calldata _config) public _ward_ {
        if (_config.tags.length != _config.srcs.length) revert ErrConfig();
        if (_config.quorum == 0) revert ErrZeroQuorum();
        configs[dtag] = _config;
    }

    function getConfig(bytes32 dtag) view public returns (Config memory) {
        return configs[dtag];
    }

    function poke(bytes32 dtag) public {
        Config storage config = configs[dtag];
        uint len = config.srcs.length;
        if (len == 0) revert ErrQuorum();
        bytes32[] memory data = new bytes32[](len);
        uint256 minttl = type(uint256).max;
        uint256 count = 0;

        for(uint256 i = 0; i < len; i++) {
            address src = config.srcs[i];
            bytes32 tag = config.tags[i];
            (bytes32 val, uint256 _ttl) = feedbase.pull(src, tag);
            if (block.timestamp > _ttl) {
                continue;
            }
            if (count == 0 || val >= data[count - 1]) {
                data[count] = val;
            } else {
                uint256 j = 0;
                while (val >= data[j]) {
                    j++;
                }
                for(uint256 k = count; k > j; k--) {
                    data[k] = data[k - 1];
                }
                data[j] = val;
            }
            if (_ttl < minttl) {
                minttl = _ttl;
            }
            count++;
        }
        if (count < config.quorum) revert ErrQuorum();

        bytes32 median;
        if (count % 2 == 0) {
            uint256 val1 = uint256(data[(count / 2) - 1]);
            uint256 val2 = uint256(data[count / 2]);
            median = bytes32((val1 + val2) / 2);
        } else {
            median = data[(count - 1) / 2];
        }
        feedbase.push(dtag, median, minttl);
    }
}
