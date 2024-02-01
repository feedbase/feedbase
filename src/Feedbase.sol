// SPDX-License-Identifier: AGPL-v3.0
// Copyright (C) 2021-2024 halys

pragma solidity ^0.8.19;

import { Read } from './mixin/Read.sol';

contract Feedbase {

    struct Feed {
        bytes32 val;
        uint256 ttl;
    }

    event Push(
        address indexed src,
        bytes32 indexed tag,
        bytes32         val,
        uint256         ttl
    );

    error ErrTTL();
    uint256 internal constant READ = 0;

    // src -> tag -> Feed
    mapping(address=>mapping(bytes32=>Feed)) _feeds;

    function pull(address src, bytes32 tag)
      external view returns (bytes32 val, uint256 ttl) {
        Feed storage feed = _feeds[src][tag];
        ttl = feed.ttl;
        if (ttl == READ) (val, ttl) = Read(src).read(tag);
        else val = feed.val;
    }

    function push(bytes32 tag, bytes32 val, uint256 ttl) external payable {
        if (ttl == READ) revert ErrTTL();
        _feeds[msg.sender][tag] = Feed({val: val, ttl: ttl});
        emit Push(msg.sender, tag, val, ttl);
    }
}
