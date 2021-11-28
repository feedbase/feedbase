// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.6;

interface SelectorProvider {
  function getSelectors() external returns (uint quorum, address[] calldata selectors, address[] calldata readers);
}

contract FixedSelectorProvider is SelectorProvider {
  address public owner;
  address[] selectors;
  address[] readers;
  constructor() {
    owner = msg.sender;
  }
  function setOwner(address newOwner) public {
    require(msg.sender == owner, 'ERR_OWNER');
    owner = newOwner;
  }
  function setSelectors(address[] calldata _selectors, address[] calldata _readers) public {
    require(msg.sender == owner, 'ERR_OWNER');
    selectors = _selectors;
    readers   = _readers;
  }
  function getSelectors() external view override
    returns (uint quorum, address[] memory set, address[] memory reads)
  {
    return (1, selectors, readers);
  }
}

contract FixedSelectorProviderFactory {
  mapping(address=>bool) public builtHere;
  function build() public returns (FixedSelectorProvider) {
    FixedSelectorProvider sp = new FixedSelectorProvider();
    sp.setOwner(msg.sender);
    return sp;
  }
}
