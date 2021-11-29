// SPDX-License-Identifier: AGPL-v3.0
pragma solidity ^0.8.9;

import "../Feedbase.sol";
import "../erc20/IERC20.sol";

contract UniswapV3Adapter {
  // src -> cash -> balance
  mapping(address=>mapping(address=>uint256)) _bals;

  Feedbase fb;

  constructor(address _fb) {
    fb   = Feedbase(_fb);
  }

  function balances(address who, address cash) public view returns (uint) {
    return _bals[who][cash];
  }

}