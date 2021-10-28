// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.6;

import '../Feedbase.sol';
import './SelectorProvider.sol';

contract MedianizerCombinator {
  SelectorProvider public gov;
  Feedbase public fb;

  constructor(address gov_, address fb_) {
    gov = SelectorProvider(gov_);
    fb = Feedbase(fb_);
  }

  function poke(bytes32 tag, address cash) public {
    (uint256 quorum, address[] memory sources) = gov.getSelectors();
    require(sources.length % 2 != 0, 'ERR_SOURCE_COUNT');
    uint balance = fb.requested(address(this), tag, cash);
    for(uint i = 0; i < sources.length; i++) {
      fb.request(sources[i], tag, cash, balance / sources.length);
    }
  }

  function push(bytes32 tag) public {
    (uint256 quorum, address[] memory sources) = gov.getSelectors();
    require(sources.length % 2 != 0, 'ERR_SOURCE_COUNT');
    uint256 minttl = type(uint256).max;
    uint256 median = 0;
    for(uint i = 0; i < sources.length; i++ ) {
      (bytes32 val, uint256 ttl) = fb.read(sources[i], tag);
      // TODO: actual median implementation
      median += uint256(val);
    }
    fb.push(tag, bytes32(median), minttl, address(0));
  }
}