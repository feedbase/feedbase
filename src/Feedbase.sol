// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.15;

contract Feedbase {
    struct Feed {
      bytes32 val;
      uint256 ttl;
    }

    event Push(
        address indexed src
      , bytes32 indexed tag
      , bytes32         val
      , uint256         ttl
    );

    // src -> tag -> Feed
    mapping(address=>mapping(bytes32=>Feed)) _feeds;

    function pull(address src, bytes32 tag) public view returns (bytes32 val, uint256 ttl) {
      Feed storage feed = _feeds[src][tag];
      return (feed.val, feed.ttl);
    }

    function push(bytes32 tag, bytes32 val, uint256 ttl) external {
      _feeds[msg.sender][tag] = Feed({val: val, ttl: ttl});
      emit Push(msg.sender, tag, val, ttl);
    }
}

