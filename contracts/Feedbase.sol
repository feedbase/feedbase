// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.4;

contract Feedbase {
  // id -> Feed
  mapping(bytes32=>Feed) _feeds;

  function fid(address src, bytes32 tag) internal pure returns (bytes32) {
    return keccak256(abi.encode(bytes32(bytes20(src)), tag));
  }

  struct Feed {
    // config
    string  desc;
    IERC20  cash;
    uint256 cost;

    // balance
    uint256 paid;

    // update
    uint64  seq;
    uint64  sec;
    uint64  ttl;
    bytes   val;
  }

  event Push(
      address indexed src
    , bytes32 indexed tag
    , uint64  indexed seq
    , uint64          sec
    , uint64          ttl
    , bytes           val
  );

  function read(address src, bytes32 tag) public view returns (uint64 ttl, bytes memory val) {
    Feed storage feed = _feeds[fid(src, tag)];
    require(feed.sec >= block.timestamp, 'ERR_READ_EARLY');
    require(feed.ttl <  block.timestamp, 'ERR_READ_LATE');
    return (feed.ttl, feed.val);
  }

  function readFull(address src, bytes32 tag) public view returns (Feed memory) {
    Feed storage feed = _feeds[fid(src, tag)];
    require(feed.sec >= block.timestamp, 'ERR_READ_EARLY');
    require(feed.ttl <  block.timestamp, 'ERR_READ_LATE');
    return feed;
  }

  function push(bytes32 tag, uint64 seq, uint64 sec, uint64 ttl, bytes calldata val) public {
    Feed storage feed = _feeds[fid(msg.sender, tag)];
    Feed storage self = _feeds[fid(address(this), tag)];

    require(feed.paid >= feed.cost);
    require(seq > feed.seq, 'ERR_PUSH_SEQ');
    require(sec >= feed.sec, 'ERR_PUSH_SEC');

    feed.paid -= feed.cost;
    self.paid += feed.cost;

    feed.seq = seq;
    feed.sec = sec;
    feed.ttl = ttl;
    feed.val = val;

    emit Push(msg.sender, tag, seq, sec, ttl, val);
  }

  function request(address src, bytes32 tag, uint amt) public {
    _feeds[fid(msg.sender, tag)].paid  -= amt;
    _feeds[fid(src, tag)].paid         += amt;
  }

  function topUp(bytes32 tag, uint amt) public {
    Feed storage feed = _feeds[fid(msg.sender, tag)];
    feed.cash.transferFrom(msg.sender, address(this), amt);
    feed.paid += amt;
  }

  function cashout(bytes32 tag, uint amt) public {
    Feed storage feed = _feeds[fid(msg.sender, tag)];
    feed.paid -= amt;
    feed.cash.transfer(msg.sender, amt);
  }

  function config(bytes32 tag, address cash, uint256 cost, string calldata desc) public {
    Feed storage feed = _feeds[fid(msg.sender, tag)];
    feed.cash = IERC20(cash);
    feed.cost = cost;
    feed.desc = desc;
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


