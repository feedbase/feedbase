// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.4;

contract Feedbase {
  struct Feed {
    // config
    IERC20 cash;
    string desc;
    uint   cost;
    uint   paid;

    // update
    uint64  seq;
    uint64  sec;
    uint64  ttl;
    bytes   val;
  }

  // id -> Feed
  mapping(bytes32=>Feed)     _feeds;

  function id(bytes32 tag, address src) internal pure returns (bytes32) {
    return keccak256(abi.encode(bytes32(tag), bytes32(bytes20(src))));
  }

  event Update(
      bytes32 indexed tag
    , address indexed src
    , bytes         val
    , uint64          ttl
    , uint64          sec
    , uint64          seq
  );

  function read(bytes32 tag, address src) public view returns (bytes memory val, uint64 ttl) {
    Feed storage f = _feeds[id(tag, src)];
    return (f.val, f.ttl);
  }

  function push(bytes32 tag, bytes calldata val, uint64 ttl, uint64 sec, uint64 seq) public {
    Feed storage feed = _feeds[id(tag, msg.sender)];
    Feed storage self = _feeds[id(tag, address(this))];

    require(feed.paid >= feed.cost);
    require(seq > feed.seq, 'ERR_PUSH_SEQ');
    require(sec <= block.timestamp, 'ERR_PUSH_SEC');

    feed.paid -= feed.cost;
    self.paid += feed.cost;

    feed.val = val;
    feed.ttl = ttl;
    feed.sec = sec;
    feed.seq = seq;

    emit Update(tag, msg.sender, val, ttl, sec, seq);
  }

  function request(bytes32 tag, address src, uint amt) public {
    _feeds[id(tag, msg.sender)].paid  -= amt;
    _feeds[id(tag, src)].paid         += amt;
  }

  function topUp(bytes32 tag, uint amt) public {
    bytes32 fid = id(tag, msg.sender);
    Feed storage feed = _feeds[fid];
    feed.cash.transferFrom(msg.sender, address(this), amt);
    feed.paid += amt;
  }

  function cashout(bytes32 tag, uint amt) public {
    bytes32 fid = id(tag, msg.sender);
    Feed storage feed = _feeds[fid];
    feed.paid -= amt;
    feed.cash.transfer(msg.sender, amt);
  }
}

interface IERC20 {
    function totalSupply() external view returns (uint);
    function balanceOf(address guy) external view returns (uint);
    function allowance(address src, address guy) external view returns (uint);

    function approve(address guy, uint wad) external returns (bool);
    function transfer(address dst, uint wad) external returns (bool);
    function transferFrom(
        address src, address dst, uint wad
    ) external returns (bool);

    event Approval(address indexed src, address indexed guy, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
}


