pragma solidity ^0.7.0;
//import "@chainlink/contracts/src/v0.7/interfaces/AggregatorV2V3Interface.sol";
import "@chainlink/contracts/src/v0.7/tests/MockV3Aggregator.sol";

contract MockAggregator is MockV3Aggregator {
  constructor(uint8 _decimals, int256 _initialAnswer) MockV3Aggregator(_decimals, _initialAnswer) {}
}
