// SPDX-License-Identifier: GPL-v3.0

import '../Feedbase.sol';

import './SelectorProvider.sol';

pragma solidity ^0.8.10;

contract ThresholdCombinator {
  SelectorProvider public gov;
  Feedbase public fb;

/*
  function poke(bytes32 tag, address cash) public {
    (uint256 quorum, address[] memory sources) = gov.getSelectors();
    uint balance = fb.requested(address(this), tag, cash);
    for( uint i = 0; i < sources.length; i++) {
      fb.request(sources[i], tag, cash, balance / sources.length);
    }
  }
*/

  function push(bytes32 tag, bytes32 hint) public {
    (uint256 quorum, address[] memory sources) = gov.getSelectors();
    require(quorum > sources.length / 2, 'ERR_QUORUM');

    uint256 count;
    uint256 minttl = type(uint256).max;
    for( uint i = 0; i < sources.length; i++ ) {
      (bytes32 val, uint256 ttl) = fb.read(sources[i], tag);
      if (ttl < block.timestamp) {
        continue;
      }
      if (ttl < minttl) {
        minttl = ttl;
      }
      if (val == hint) {
        count++;
        if (count >= quorum) {
          fb.push(tag, val, minttl);
          return;
        }
      }
    }
    require(false, 'ERR_QUORUM');
  }

/*
  function topUp(IERC20 cash, uint amt) public {
    cash.transferFrom(msg.sender, address(this), amt);
    cash.approve(address(fb), amt);
    fb.deposit(address(cash), address(this), amt);
  }
*/
}
