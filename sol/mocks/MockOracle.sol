// (c) nikolai mushegian
// SPDX-License-Identifier: AGPL-v3.0
pragma solidity ^0.6.6;
import "@chainlink/contracts/src/v0.6/Oracle.sol";

contract MockOracle is Oracle {

  constructor(address _link) public Oracle(_link) {}

}
