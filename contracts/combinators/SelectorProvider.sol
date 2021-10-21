// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.6;

interface SelectorProvider {
  function getSelectors()
    external
    returns (uint256 quorum, address[] calldata selectors);
}

contract FixedSelectorProvider is SelectorProvider {
  address public owner;
  address[] selectors;

  function setOwner(address newOwner) public {
    require(msg.sender == owner, "ERR_OWNER");
    owner = newOwner;
  }

  function setSelectors(address[] calldata set) public {
    require(msg.sender == owner, "ERR_OWNER");
    selectors = set;
  }

  function getSelectors()
    external
    view
    override
    returns (uint256 quorum, address[] memory set)
  {
    return (1, selectors);
  }
}

contract FixedSelectorProviderFactory {
  mapping(address => bool) public builtHere;

  function build() public returns (FixedSelectorProvider) {
    FixedSelectorProvider sp = new FixedSelectorProvider();
    sp.setOwner(msg.sender);
    return sp;
  }
}
