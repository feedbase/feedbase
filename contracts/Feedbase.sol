// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.1;

contract Feedbase {
  struct Value {
    bytes32 val;
    uint64  ttl;
  }

  // tag,source -> value,ttl
  mapping(bytes32 => mapping( address => Value ))    _feeds;

  event Update(
      bytes32 indexed tag
    , address indexed source
    , bytes32         val
    , uint64          ttl
  );

  function read(bytes32 tag, address source) public view returns (bytes32 value, uint64 ttl) {
    Value memory v = _feeds[tag][source];
    return (v.val, v.ttl);
  }

  function push(bytes32 tag, bytes32 value, uint64 ttl) public {
    Value memory v;
    v.val = value;
    v.ttl = ttl;
    _feeds[tag][msg.sender] = v;
    emit Update(tag, msg.sender, v.val, v.ttl);
  }
}
