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
        uint256 minttl  = type(uint256).max;
        uint256 liveIdx = 0; // # next live feed index

        // copy unexpired feeds into a sorted list
        for(uint256 i = 0; i < len; i++) {
            address src = config.srcs[i];
            bytes32 tag = config.tags[i];

            (bytes32 val, uint256 _ttl) = feedbase.pull(src, tag);
            if (block.timestamp > _ttl) {
                // expired
                continue;
            }

            // if it's > all previous elements, insert it @liveIdx
            // otherwise, find a spot between the two previous elements
            if (liveIdx == 0 || val >= data[liveIdx - 1]) {
                data[liveIdx] = val;
            } else {
                // find spot where data[j] <= val <= data[j+1]
                uint256 j = 0;
                while (val >= data[j]) {
                    j++;
                }

                // shift subsequent elements forward to make room for val
                for(uint256 k = liveIdx; k > j; k--) {
                    data[k] = data[k - 1];
                }

                data[j] = val;
            }

            if (_ttl < minttl) {
                minttl = _ttl;
            }

            liveIdx++;
        }

        // liveIdx is now number of unexpired src feeds
        if (liveIdx < config.quorum) revert ErrQuorum();

        // have a sorted list of unexpired values; take the median and push
        bytes32 median;
        if (liveIdx % 2 == 0) {
            uint256 val1 = uint256(data[(liveIdx / 2) - 1]);
            uint256 val2 = uint256(data[liveIdx / 2]);
            median = bytes32((val1 + val2) / 2);
        } else {
            median = data[(liveIdx - 1) / 2];
        }

        feedbase.push(dtag, median, minttl);
    }
}
