// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.19;

import './Feedbase.sol';
import { Ward } from './mixin/ward.sol';

contract Medianizer is Ward {
    error ErrQuorum();

    struct Source {
        address src;
        bytes32 tag;
    }

    Feedbase public immutable feedbase;
    mapping(bytes32 dtag => Source[]) public sources;
    mapping(bytes32 dtag => uint) quorums;


    constructor(address fb) Ward() {
        feedbase = Feedbase(fb);
    }

    function setSources(bytes32 dtag, Source[] calldata newSources) public _ward_ {
        delete sources[dtag];
        for (uint i = 0; i < newSources.length; ++i) {
            sources[dtag].push(Source(newSources[i].src, newSources[i].tag));
        }
    }

    function setQuorum(bytes32 dtag, uint newQuorum) public _ward_ {
        if (newQuorum == 0) revert ErrQuorum();
        quorums[dtag] = newQuorum;
    }

    function poke(bytes32 dtag) public {
        Source[] memory srcs = sources[dtag];
        if (srcs.length == 0) revert ErrQuorum();
        bytes32[] memory data = new bytes32[](srcs.length);
        uint256 minttl = type(uint256).max;
        uint256 count = 0;

        for(uint256 i = 0; i < srcs.length; i++) {
            address src = srcs[i].src;
            bytes32 tag = srcs[i].tag; 
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
        if (count < quorums[dtag]) revert ErrQuorum();

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
