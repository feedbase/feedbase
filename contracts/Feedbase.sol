// (c) nikolai mushegian
// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.6;

import "./erc20/IERC20.sol";

contract Feedbase {
  struct Feed {
    bytes32 val;
    uint256 ttl;
  }

  struct Config {
    uint256 cost;
    uint256 paid;
  }

  // _feeds  :: src -> tag -> Feed
  mapping(address=>mapping(bytes32=>Feed))    public _feeds;
  // _bals   :: src -> cash -> balance
  mapping(address=>mapping(address=>uint256)) public _bals;
  // _config :: src -> tag -> cash -> Config
  mapping(address=>mapping(
    bytes32=>mapping(address=>Config)))       public _config;

  event Push(
      address indexed src
    , bytes32 indexed tag
    , bytes32         val
    , uint256         ttl
  );

  event Paid(
      address indexed cash
    , address indexed src
    , address indexed dst
    , uint256         amt
  );

  function read(address src, bytes32 tag) public view returns (bytes32 val, uint256 ttl) {
    Feed storage feed = _feeds[src][tag];
    require(block.timestamp < feed.ttl, 'ERR_READ');
    return (feed.val, feed.ttl);
  }

  function push(bytes32 tag, bytes32 val, uint256 ttl, address cash) public returns (uint256) {
    Feed storage feed = _feeds[msg.sender][tag];
    Config storage config = _config[msg.sender][tag][cash];

    config.paid -= config.cost;
    _bals[msg.sender][cash] += config.cost;
   
    feed.ttl = ttl;
    feed.val = val; 

    emit Push(msg.sender, tag, val, ttl);

    return config.cost;
  }

  function requested(address src, bytes32 tag, address cash) public view returns (uint256) {
    return _config[src][tag][cash].paid;
  }

  function request(address src, bytes32 tag, address cash, uint256 amt) public {
    _bals[msg.sender][cash] -= amt;
    _config[src][tag][cash].paid += amt;
    emit Paid(cash, msg.sender, src, amt);
  }

  function deposit(address cash, uint amt) public payable {
    if (cash == address(0))  {
      require(msg.value == amt, 'ERR_DEPOSIT_AMT');
    } else {
      bool ok = IERC20(cash).transferFrom(msg.sender, address(this), amt);
      require(ok, 'ERR_DEPOSIT_PULL');
    }
    _bals[msg.sender][cash] += amt;
  }

  function withdraw(address cash, uint amt) public {
    _bals[msg.sender][cash] -= amt;
    if (cash == address(0)) {
      (bool ok, ) = msg.sender.call{value:amt}("");
      require(ok, 'ERR_WITHDRAW_CALL');
    } else {
      bool ok = IERC20(cash).transfer(msg.sender, amt);
      require(ok, 'ERR_WITHDRAW_PUSH');
    }
  }

  function balances(address cash, address who) public view returns (uint) {
    return _bals[who][cash];
  }

  function setCost(bytes32 tag, address cash, uint256 cost) public {
    _config[msg.sender][tag][cash].cost = cost;
  }

}

