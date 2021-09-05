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

    bool    live; // enabled
    bool    toss; // throw on expired feed read
    bool    froc; // "first-read-on-chain" mode
  }

  // src -> tag -> Feed
  mapping(address=>mapping(bytes32=>Feed)) _feeds;
  // user -> cash -> balance
  mapping(address=>mapping(address=>uint256)) _bals;
  // src -> tag -> cash -> Config
  mapping(address=>mapping(bytes32=>mapping(address=>Config))) _config;

  event Push(
      address indexed src
    , bytes32 indexed tag
    , uint256         ttl
    , bytes32         val
  );

  event Paid(
      address indexed cash
    , address indexed src
    , address indexed dst
    , uint256         amt
  );

  function read(address src, bytes32 tag) public view returns (uint256 ttl, bytes32 val) {
    Feed storage feed = _feeds[src][tag];
    require(feed.ttl >  block.timestamp, 'ERR_READ_LATE');
    return (feed.ttl, feed.val);
  }

  function pushFree(bytes32 tag, uint256 ttl, bytes32 val) public returns (uint256) {
    return push(tag, ttl, val, IERC20(address(0)));
  }

  function push(bytes32 tag, uint256 ttl, bytes32 val, IERC20 cash) public returns (uint256) {
    Feed storage feed = _feeds[msg.sender][tag];
    Config storage config = _config[msg.sender][tag][address(cash)];

    config.paid -= config.cost;
    _bals[msg.sender][address(cash)] += config.cost;
   
    feed.ttl = ttl;
    feed.val = val; 

    emit Push(msg.sender, tag, ttl, val);

    return config.cost;
  }

  function requested(address src, bytes32 tag, IERC20 cash) public view returns (uint256) {
    return _config[src][tag][address(cash)].paid;
  }

  function request(address src, bytes32 tag, IERC20 cash, uint amt) public {
    _bals[msg.sender][address(cash)] -= amt;
    _config[src][tag][address(cash)].paid += amt;
    emit Paid(address(cash), msg.sender, src, amt);
  }

  function deposit(IERC20 cash, uint amt) public payable {
    if (address(cash) == address(0))  {
      require(msg.value == amt, 'feedbase-deposit-value');
    } else {
      bool ok = IERC20(cash).transferFrom(msg.sender, address(this), amt);
      require(ok, 'ERR_ERC20_PULL');
    }
    _bals[msg.sender][address(cash)] += amt;
  }

  function withdraw(IERC20 cash, uint amt) public {
    _bals[msg.sender][address(cash)] -= amt;
    if (address(cash) == address(0)) {
      (bool ok, ) = msg.sender.call{value:amt}("");
      require(ok, 'ERR_WITHDRAW_CALL');
    } else {
      bool ok = IERC20(cash).transfer(msg.sender, amt);
      require(ok, 'ERR_ERC20_PUSH');
    }
  }

  function balanceOf(IERC20 cash, address who) public view returns (uint) {
    return _bals[who][address(cash)];
  }

  function setCost(bytes32 tag, address cash, uint256 cost) public {
    _config[msg.sender][tag][cash].cost = cost;
  }


}


