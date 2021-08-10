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
  uint public quorum;
  address[] public sources;
  SelectorProvider public gov;
  Feedbase public fb;

  function poke(bytes32 tag, bytes memory hint) public {
    (quorum, sources) = gov.getSelectors();
    require(quorum > sources.length / 2, 'ERR_QUORUM');

    uint256 count;
    uint64 minttl = type(uint64).max;
    for( uint i = 0; i < sources.length; i++ ) {
      (uint64 ttl, bytes memory val) = fb.read(sources[i], tag);
      if (ttl < minttl) {
        minttl = ttl;
      }
      if (true) { // if val == hint
        count++;
        if (count >= quorum) {
          fb.push(tag, 1, uint64(block.timestamp), minttl, val);
          break;
        }
      }
    }
    require(false, 'ERR_QUORUM');
  }
}
