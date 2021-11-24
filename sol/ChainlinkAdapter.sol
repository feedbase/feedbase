// (c) nikolai mushegian
// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.9;

import "./Feedbase.sol";

interface ChainlinkAdapterInterface {
  // require cash==LINK
  function request(address oracle, bytes32 specId, address cash, uint256 amt) external;
  function requested(address oracle, bytes32 specId, address cash) external;
  function callback(bytes32 requestId, bytes32 data) external;
  function read(address oracle, bytes32 specId) external returns (bytes32, uint256);
}

// extends ChainlinkClient
contract ChainlinkAdapter is ChainlinkAdapterInterface {
  mapping(address=>mapping(bytes32=>bytes32)) tags;
  function request(address oracle, bytes32 specId, address cash, uint256 amt) public override {
    require( false, 'unimplemented' );
  }
  function requested(address oracle, bytes32 specId, address cash) public override {
    require( false, 'unimplemented' );
  }
  function callback(bytes32 requestId, bytes32 data) public override {
    require( false, 'unimplemented' );
  }
  function read(address oracle, bytes32 specId) public override returns (bytes32 val, uint256 ttl) {
    require( false, 'unimplemented' );
  }
}
