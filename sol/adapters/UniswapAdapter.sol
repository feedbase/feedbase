// SPDX-License-Identifier: AGPL-v3.0
pragma solidity ^0.8.9;

import "../Feedbase.sol";
import "../erc20/IERC20.sol";

contract UniswapV3Adapter {
  // _bals  :: src -> cash -> balance
  mapping(address=>mapping(address=>uint256)) public _bals;

  Feedbase fb;
  address public owner;

  constructor(address _fb) {
    fb   = Feedbase(_fb);
    owner = msg.sender;
  }

  function deposit(address cash, address user, uint amt) public payable {
    bool ok = IERC20(cash).transferFrom(msg.sender, address(this), amt);
    require(ok, 'ERR_DEPOSIT_PULL');
    IERC20(cash).approve(address(fb), amt);
    fb.deposit(cash, address(this), amt);
    _bals[user][cash] += amt;
  }

  function withdraw(address cash, address user, uint amt) public {
    require(cash != address(0), 'ERR_CASH_ADDR');
    _bals[msg.sender][cash] -= amt;
    fb.withdraw(cash, user, amt);
  }

  function setCost(bytes32 tag, address cash, uint256 cost) public {
    require(msg.sender == owner, 'ERR_OWNER');
    require(cash != address(0), 'ERR_CASH_ADDR');
    fb.setCost(tag, cash, cost);
  }

  function getCost(bytes32 tag, address cash)
    public
    view
    returns (uint256) {
    return fb.getCost(address(this), tag, cash);
  }

  function balances(address cash, address who) public view returns (uint) {
    return _bals[who][cash];
  }

  function setOwner(address newOwner) public {
    require(msg.sender == owner, 'ERR_OWNER');
    owner = newOwner;
  }
}

contract UniswapV3AdapterFactory {
  mapping(address=>bool) public builtHere;
  function build(address _fb) public returns (UniswapV3Adapter) {
    UniswapV3Adapter uni = new UniswapV3Adapter(_fb);
    uni.setOwner(msg.sender);
    return uni;
  }
}