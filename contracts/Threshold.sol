// SPDX-License-Identifier: GPL-v3.0

import './Feedbase.sol';

pragma solidity ^0.8.6;

interface SelectorProvider {
  function getSelectors() external returns (uint quorum, address[] calldata selectors);
}

contract FixedSelectorProvider is SelectorProvider {
  address[] selectors;
  function setSelectors(address[] calldata set) public {
    selectors = set;
  }
  function getSelectors() external view override
    returns (uint quorum, address[] memory set)
  {
    return (1, selectors);
  }
}

contract ThresholdCombinator {
  SelectorProvider public gov;
  Feedbase public fb;

  function poke(bytes32 tag, IERC20 cash) public {
    (uint256 quorum, address[] memory sources) = gov.getSelectors();
    uint balance = fb.feedDemand(cash, address(this), tag);
    for( uint i = 0; i < sources.length; i++) {
      fb.request(cash, sources[i], tag, balance / sources.length);
    }
  }

  function push(bytes32 tag, bytes memory hint) public {
    (uint256 quorum, address[] memory sources) = gov.getSelectors();
    require(quorum > sources.length / 2, 'ERR_QUORUM');

    uint256 count;
    uint64 minttl = type(uint64).max;
    for( uint i = 0; i < sources.length; i++ ) {
      (uint64 ttl, bytes memory val) = fb.read(sources[i], tag);
      if (ttl < block.timestamp) {
        continue;
      }
      if (ttl < minttl) {
        minttl = ttl;
      }
      if (keccak256(val) == keccak256(hint)) {
        count++;
        if (count >= quorum) {
          fb.push(tag, minttl, val);
          return;
        }
      }
    }
    require(false, 'ERR_QUORUM');
  }

  function cashOut(IERC20 cash, bytes32 tag) public {
    uint256 fees = fb.feedCollected(cash, address(this), tag);
    fb.cashOut(cash, tag, fees);
    cash.transfer(msg.sender, fees);
  }

  function topUp(IERC20 cash, bytes32 tag, uint amt) public {
    cash.transferFrom(msg.sender, address(this), amt);
    cash.approve(address(fb), amt);
    fb.topUp(cash, tag, amt);
  }
}
