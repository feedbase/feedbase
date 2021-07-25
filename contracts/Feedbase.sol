// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.4;

contract Feedbase {
  struct Feed {
    // config
    IERC20 gem;
    string desc;
    uint   cost;
    uint   demand;

    // value
    bytes32 val;
    uint64  ttl;

    uint64  sec;
    uint64  seq;
  }

  // who -> bal
  mapping(address=>uint256)                        _bals;
  // fid -> demand
  mapping(bytes32 => uint256) _fees;
  // id -> Feed
  mapping(bytes32=>Feed) _feeds;

  function id(bytes32 tag, address src) internal pure returns (bytes32) {
    return keccak256(abi.encode(bytes32(tag), bytes32(bytes20(src))));
  }

  event Update(
      bytes32 indexed tag
    , address indexed src
    , bytes32         val
    , uint64          ttl
    , uint64          sec
    , uint64          seq
  );

  function read(bytes32 tag, address src) public view returns (bytes32 value, uint64 ttl) {
    Feed storage f = _feeds[id(tag, src)];
    return (f.val, f.ttl);
  }

  function push(bytes32 tag, bytes32 val, uint64 ttl, uint64 sec, uint64 seq) public {
    bytes32 fid = id(tag, msg.sender);
    Feed storage feed = _feeds[fid];

    require(feed.demand >= feed.cost);
    require(seq > feed.seq, 'ERR_PUSH_SEQ');
    require(sec <= block.timestamp, 'ERR_PUSH_SEC');

    _fees[fid]        -= feed.cost;
    _bals[msg.sender] += feed.cost;

    _feeds[fid].val = val;
    _feeds[fid].ttl = ttl;
    _feeds[fid].sec = sec;
    _feeds[fid].seq = seq;

    emit Update(tag, msg.sender, val, ttl, sec, seq);
  }

  function request(bytes32 tag, address src, uint amt) public {
    _bals[msg.sender] -= amt;
    _fees[id(tag, src)] += amt;
  }

  function topUp(IERC20 gem, uint amt) public {
    gem.transferFrom(msg.sender, address(this), amt);
    _bals[msg.sender] += amt;
  }

  function cashout(IERC20 gem, uint amt) public {
    _bals[msg.sender] -= amt;
    gem.transfer(msg.sender, amt);
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


