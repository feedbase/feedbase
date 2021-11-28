// (c) nikolai mushegian
// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.9;

interface Readable {
  function read(address, bytes32) external view returns (bytes32, uint256);
  function request(address src, bytes32 tag, address cash, uint256 amt) external;
}
