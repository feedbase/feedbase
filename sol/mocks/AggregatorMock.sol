pragma solidity ^0.7.0;
import "@chainlink/contracts/src/v0.7/interfaces/AggregatorV2V3Interface.sol";

contract MockAggregator is AggregatorV2V3Interface { 
  function latestAnswer()
    external
    view
    override
    returns (
      int256
    ) {
    require(false, 'unimplemented');
    return 0;
  }
  
  function latestTimestamp()
    external
    view
    override
    returns (
      uint256
    ) {
    require(false, 'unimplemented');
    return 0;
  }


  uint256 _latestRound = 0;
  uint256 _updatedAt   = block.timestamp;
  function latestRound()
    external
    view
    override
    returns (
      uint256
    ) {
    return _latestRound;
  }


  int256 _answer;
  function setAnswer(int n) external {
    _updatedAt  = block.timestamp;
    _answer    = n;
  }


  function getAnswer(
    uint256 roundId
  )
    external
    view
    override
    returns (
      int256
    ) {
    require(false, 'unimplemented');
    return 0;
  }


  function getTimestamp(
    uint256 roundId
  )
    external
    view
    override
    returns (
      uint256
    ) {
    require(false, 'unimplemented');
    return 0;
  }

  function decimals()
    external
    view
    override
    returns (
      uint8
    ) {
    require(false, 'unimplemented');
    return 0;
  }


  function description()
    external
    view
    override
    returns (
      string memory
    ) {
    require(false, 'unimplemented');
    return "";
  }


  function version()
    external
    view
    override
    returns (
      uint256
    ) {
    require(false, 'unimplemented');
    return 0;
  }


  // getRoundData and latestRoundData should both raise "No data present"
  // if they do not have data to report, instead of returning unset values
  // which could be misinterpreted as actual reported values.
  function getRoundData(
    uint80 _roundId
  )
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
    require(false, 'unimplemented');
    return (0,0,0,0,0);
  }

  uint80 _roundId = 0;
  function latestRoundData()
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
    return (_roundId,_answer,0,_updatedAt,_roundId);
  }
}
