// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.9;

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
    (, address[] memory sources) = gov.getSelectors();
    uint256 balance = fb.requested(address(this), tag, cash);
    for(uint96 i = 0; i < sources.length; i++) {
      uint256 cost = fb.getCost(sources[i], tag, cash);
      require(balance >= cost, 'ERR_LOW_BAL');
      fb.request(sources[i], tag, cash, cost);
      balance -= cost;
      // TODO: best way to handle insufficient balance
    }
  }

  function push(bytes32 tag) public {
    (, address[] memory sources) = gov.getSelectors();
    bytes32[] memory data = new bytes32[](sources.length);
    uint96 count = 0;
  
    for(uint96 i = 0; i < sources.length; i++) {
      (bytes32 val,) = fb.read(sources[i], tag);
      if (count == 0 || val >= data[count - 1]) {
        data[count] = val;
      } else {
        uint96 j = 0;
        while (val >= data[j]) {
          j++;
        }
        for(uint96 k = count; k > j; k--) {
          data[k] = data[k - 1];
        }
        data[j] = val;
      }
      count++;
    }

    bytes32 median;
    if (count % 2 == 0) {
      uint256 val1 = uint256(data[(count / 2) - 1]);
      uint256 val2 = uint256(data[count / 2]);
      median = bytes32((val1 + val2) / 2);
    } else {
      median = data[(count - 1) / 2];
    }

    fb.push(tag, median, type(uint256).max, address(0));
  }
}
