// (c) nikolai mushegian
// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import "./Feedbase.sol";

contract FeedbaseChainlinkAdapter {
  FeedRegistryInterface internal registry;
  Feedbase fb;
  address LINK;
  mapping(address=>bool) accepts;
  address public owner;

  constructor(address _fb, address _LINK, address _registry) {
    fb       = Feedbase(_fb);
    registry = FeedRegistryInterface(_registry);
    LINK     = _LINK;
    owner    = msg.sender;
  }

  modifier auth {
    require(msg.sender == owner, 'feedbasechainlinkadapter-bad-owner');
    _;
  }

  function getLatestPrice(address token) public view returns (int) {
    (bytes32 val,) = fb.read(address(this), bytes32(uint256(uint160(token))));
    return int256(uint256(val));
  }

  function setCost(address token, address cash, uint256 cost) public auth {
    if( cost > 0 && !accepts[cash] ) {
      accepts[cash] = true;
    } else if( cost == 0 && accepts[cash] ) {
      accepts[cash] = false;
    }
    fb.setCost(bytes32(uint256(uint160(token))), cash, cost);
  }

  function pushLatestPrice(address token, address cash) public returns (int) {
    require( accepts[cash], "token not registered" );
    (,int price,,,) = registry.latestRoundData(token, LINK);
    fb.push(
      bytes32(uint256(uint160(token))),
      bytes32(uint256(price)),
      type(uint256).max,
      token
    );
    return price;
  }


  function setOwner(address newOwner) public auth {
    owner = newOwner;
  }
}
