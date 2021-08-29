// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.6;

import "./IERC20.sol";

contract Feedbase {
  struct Feed {
    bytes32 val;
    uint256 ttl;
  }

  // id -> Feed
  mapping(bytes32=>Feed) _feeds;

  function fid(address src, bytes32 tag) internal pure returns (bytes32) {
    return keccak256(abi.encode(bytes32(bytes20(src)), tag));
  }

  // fid -> cash -> payConfig
  mapping(bytes32=>mapping(address=>PayConfig)) _fees;
  // user -> cash -> balance
  mapping(address=>mapping(address=>uint256)) _bals;

  struct PayConfig {
    bool    live;
    uint256 cost;
    uint256 paid;
  }

  event Push(
      address indexed src
    , bytes32 indexed tag
    , uint256          ttl
    , bytes32         val
  );

  event Paid(
      address indexed cash
    , address indexed src
    , address indexed dst
    , uint256 amt
  );

  function read(address src, bytes32 tag) public view returns (uint256 ttl, bytes32 val) {
    Feed storage feed = _feeds[fid(src, tag)];
    require(feed.ttl >  block.timestamp, 'ERR_READ_LATE');
    return (feed.ttl, feed.val);
  }

  function readFull(address src, bytes32 tag) public view returns (Feed memory) {
    Feed storage feed = _feeds[fid(src, tag)];
    require(feed.ttl >  block.timestamp, 'ERR_READ_LATE');
    return feed;
  }

  function pushPaid(IERC20 cash, bytes32 tag, uint256 ttl, bytes32 val) public {
    PayConfig storage conf = _fees[fid(msg.sender, tag)][address(cash)];

    conf.paid -= conf.cost;
    _bals[msg.sender][address(cash)] += conf.cost;
    
    push(tag, ttl, val);
  }

  function push(bytes32 tag, uint256 ttl, bytes32 val) public {
    Feed storage feed = _feeds[fid(msg.sender, tag)];

    feed.ttl = ttl;
    feed.val = val;

    emit Push(msg.sender, tag, ttl, val);
  }

  function feedDemand(IERC20 cash, address src, bytes32 tag) public view returns (uint256) {
    return _fees[fid(src, tag)][address(cash)].paid;
  }

  function request(IERC20 cash, address src, bytes32 tag, uint amt) public {
    _bals[msg.sender][address(cash)] -= amt;
    _fees[fid(src, tag)][address(cash)].paid += amt;
    emit Paid(address(cash), msg.sender, src, amt);
  }

  function topUp(IERC20 cash, uint amt) public {
    cash.transferFrom(msg.sender, address(this), amt);
    _bals[msg.sender][address(cash)] += amt;
  }

  function cashOut(IERC20 cash, uint amt) public {
    _bals[msg.sender][address(cash)] -= amt;
    cash.transfer(msg.sender, amt);
  }

  function balanceOf(IERC20 cash, address who) public view returns (uint) {
    return _bals[who][address(cash)];
  }

  function setCost(address cash, bytes32 tag, uint256 cost) public {
    _fees[fid(msg.sender, tag)][cash].cost = cost;
  }

}


