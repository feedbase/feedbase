// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.9;

import '../Feedbase.sol';
import './TagProvider.sol';

contract DynamicMedianizerCombinator {
  TagProvider public gov;
  Feedbase public fb;

  constructor(address gov_, address fb_) {
    gov = TagProvider(gov_);
    fb = Feedbase(fb_);
  }

  function poke(address src, bytes32 tag, address cash) public {
    bytes32[] memory tags = gov.getTags();
    uint balance = fb.requested(address(this), tag, cash);
    for(uint i = 0; i < tags.length; i++) {
      fb.request(src, tags[i], cash, balance / tags.length);
    }
  }

  function push(address src, bytes32 tag) public {
    bytes32[] memory tags = gov.getTags();
    bytes32[] memory data = new bytes32[](tags.length);
    uint256 minttl = type(uint256).max;
    uint256 count = 0;
  
    for(uint256 i = 0; i < tags.length; i++) {
      (bytes32 val,) = fb.read(src, tags[i]);
      if (count == 0 || val >= data[count - 1]) {
        data[count] = val;
      } else {
        uint256 j = 0;
        while (val >= data[j]) {
          j++;
        }
        for(uint256 k = count; k > j; k--) {
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

    fb.push(tag, median, minttl, address(0));
  }
}