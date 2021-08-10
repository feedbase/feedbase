// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.6;

contract Feedbase {
  // id -> Feed
  mapping(bytes32=>Feed) _feeds;

  function fid(address src, bytes32 tag) internal pure returns (bytes32) {
    return keccak256(abi.encode(bytes32(bytes20(src)), tag));
  }

  struct Feed {
    // update
    uint64  ttl;
    bytes   val;
  }

  // fid -> cash -> payConfig
  mapping(bytes32=>mapping(address=>PayConfig)) _fees;
  struct PayConfig {
    bool    live;
    uint256 cost;
    uint256 paid;
    uint256 fees;
  }

  event Push(
      address indexed src
    , bytes32 indexed tag
    , uint64          ttl
    , bytes           val
  );

  function read(address src, bytes32 tag) public view returns (uint64 ttl, bytes memory val) {
    Feed storage feed = _feeds[fid(src, tag)];
    require(feed.ttl >  block.timestamp, 'ERR_READ_LATE');
    return (feed.ttl, feed.val);
  }

  function readFull(address src, bytes32 tag) public view returns (Feed memory) {
    Feed storage feed = _feeds[fid(src, tag)];
    require(feed.ttl >  block.timestamp, 'ERR_READ_LATE');
    return feed;
  }

  function pushPaid(IERC20 cash, bytes32 tag, uint64 ttl, bytes calldata val) public {
    PayConfig storage conf = _fees[fid(msg.sender, tag)][address(cash)];

    conf.paid -= conf.cost;
    conf.fees += conf.cost;

    push(tag, ttl, val);
  }

  function push(bytes32 tag, uint64 ttl, bytes calldata val) public {
    Feed storage feed = _feeds[fid(msg.sender, tag)];

    feed.ttl = ttl;
    feed.val = val;

    emit Push(msg.sender, tag, ttl, val);
  }

  function feedDemand(IERC20 cash, address src, bytes32 tag) public view returns (uint256) {
    return _fees[fid(src, tag)][address(cash)].paid;
  }

  function feedCollected(IERC20 cash, address src, bytes32 tag) public view returns (uint256) {
    return _fees[fid(src, tag)][address(cash)].fees;
  }

  function request(IERC20 cash, address src, bytes32 tag, uint amt) public {
    _fees[fid(msg.sender, tag)][address(cash)].paid -= amt;
    _fees[fid(src, tag)][address(cash)].paid += amt;
  }

  function topUp(IERC20 cash, bytes32 tag, uint amt) public {
    PayConfig storage conf = _fees[fid(msg.sender, tag)][address(cash)];
    cash.transferFrom(msg.sender, address(this), amt);
    conf.paid += amt;
  }

  function cashOut(IERC20 cash, bytes32 tag, uint amt) public {
    _fees[fid(msg.sender, tag)][address(cash)].fees -= amt;
    cash.transfer(msg.sender, amt);
  }

  function setCost(address cash, bytes32 tag, uint256 cost) public {
    _fees[fid(msg.sender, tag)][cash].cost = cost;
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


