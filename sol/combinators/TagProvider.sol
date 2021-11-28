// SPDX-License-Identifier: AGPL-v3.0
pragma solidity ^0.8.6;

interface TagProvider {
  function getTags() external returns (bytes32[] calldata tags);
}

contract DynamicTagProvider is TagProvider {
  address public owner;
  bytes32[] tags;
  constructor() {
    owner = msg.sender;
  }
  function setOwner(address newOwner) public {
    require(msg.sender == owner, 'ERR_OWNER');
    owner = newOwner;
  }
  function setTags(bytes32[] calldata set) public {
    require(msg.sender == owner, 'ERR_OWNER');
    tags = set;
  }
  function getTags() external view override
    returns (bytes32[] memory set)
  {
    return tags;
  }
}

contract DynamicTagProviderFactory {
  mapping(address=>bool) public builtHere;
  function build() public returns (DynamicTagProvider) {
    DynamicTagProvider tp = new DynamicTagProvider();
    tp.setOwner(msg.sender);
    return tp;
  }
}
