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

  function id(address src, bytes32 tag) internal pure returns (bytes32) {
    return keccak256(abi.encode(bytes32(bytes20(src)), tag));
  }

  event Update(
      address indexed src
    , bytes32 indexed tag
    , uint64          ttl
    , uint64          sec
    , uint64          seq
    , bytes           val
  );

  function read(address src, bytes32 tag) public view returns (bytes memory val, uint64 ttl) {
    Feed storage f = _feeds[id(src,tag)];
    return (f.val, f.ttl);
  }

  function push(bytes32 tag, uint64 ttl, uint64 sec, uint64 seq, bytes calldata val) public {
    Feed storage feed = _feeds[id(msg.sender, tag)];
    Feed storage self = _feeds[id(address(this), tag)];

    require(feed.paid >= feed.cost);
    require(seq > feed.seq, 'ERR_PUSH_SEQ');
    require(sec <= block.timestamp, 'ERR_PUSH_SEC');

    feed.paid -= feed.cost;
    self.paid += feed.cost;

    feed.val = val;
    feed.ttl = ttl;
    feed.sec = sec;
    feed.seq = seq;

    emit Update(msg.sender, tag, ttl, sec, seq, val);
  }

  function request(address src, bytes32 tag, uint amt) public {
    _feeds[id(msg.sender, tag)].paid  -= amt;
    _feeds[id(src, tag)].paid         += amt;
  }

  function topUp(bytes32 tag, uint amt) public {
    bytes32 fid = id(msg.sender, tag);
    Feed storage feed = _feeds[fid];
    feed.cash.transferFrom(msg.sender, address(this), amt);
    feed.paid += amt;
  }

  function cashout(bytes32 tag, uint amt) public {
    bytes32 fid = id(msg.sender, tag);
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


