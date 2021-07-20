pragma solidity ^0.8.1;

contract Feedbase {
  struct Value {
    bytes32 val;
    uint64  ttl;
  }

  // label,source -> value,ttl
  mapping(bytes32 => mapping( address => Value ))    _feeds;

  event Update(
      bytes32 indexed label
    , address indexed source
    , bytes32 value
    , uint64  ttl
  );

  function read(bytes32 label, address source) public view returns (bytes32 value, uint64 ttl) {
    Value memory v = _feeds[label][source];
    return (v.val, v.ttl);
  }

  function push(bytes32 label, bytes32 value, uint64 ttl) public {
    Value memory v;
    v.val = value;
    v.ttl = ttl;
    _feeds[label][msg.sender] = v;
    emit Update(label, msg.sender, v.val, v.ttl);
  }
}
