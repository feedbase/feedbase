// (c) nikolai mushegian
// SPDX-License-Identifier: AGPL-v3.0
pragma solidity ^0.8.9;

import "../Feedbase.sol";
import "@chainlink/contracts/src/v0.8/dev/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/dev/ConfirmedOwner.sol";
import "../erc20/IERC20.sol";

import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

interface ChainlinkAdapterInterface is Readable {
  function requested(address oracle, bytes32 specId, address cash)
    external returns (uint256);
  function callback(bytes32 requestId, bytes32 data) external;
  function deposit(address cash, address user, uint amt) external payable;
  function withdraw(address cash, address user, uint amt) external;
}

contract ChainlinkAdapter is ChainlinkClient, ChainlinkAdapterInterface, ConfirmedOwner {
  // _tags     :: oracle -> specId -> tag
  mapping(address=>mapping(bytes32=>bytes32)) _tags;
  // reqToSpec :: reqId -> specId
  mapping(bytes32=>bytes32) public reqToSpec;
  // _bals     :: src -> cash -> balance
  mapping(address=>mapping(address=>uint256)) _bals;
  uint256 nonce = 1;
  Feedbase fb;

  constructor(address _LINK, address _fb) ConfirmedOwner(msg.sender) {
    setChainlinkToken(_LINK);
    fb   = Feedbase(_fb);
  }

  function deposit(address cash, address user, uint amt) public payable {
    require( cash == chainlinkTokenAddress(), 'deposit can only pay with link' );
    bool ok = IERC20(cash).transferFrom(msg.sender, address(this), amt);
    require(ok, 'ERR_DEPOSIT_PULL');
    IERC20(cash).approve(address(fb), amt);
    fb.deposit(cash, address(this), amt);
    _bals[user][cash] += amt;
  }

  function withdraw(address cash, address user, uint amt) public {
    require( cash == chainlinkTokenAddress(), 'can only withdraw link' );
    _bals[msg.sender][cash] -= amt;
    fb.withdraw(cash, user, amt);
  }
  
  function setCost(address oracle, bytes32 specId, address cash, uint256 cost)
    public {
    require( msg.sender == owner(), 'setCost: permission denied' );
    require( cash == chainlinkTokenAddress(), 'can only setCost link' );
    bytes32 tag = checkTag(oracle, specId);
    fb.setCost(tag, cash, cost);
  }

  function getCost(address oracle, bytes32 specId, address cash)
    public
    view
    returns (uint256) {
    return fb.getCost(address(this), _tags[oracle][specId], cash);
  }

  //specId = Chainlink Job Specification Id
  function request(address oracle, bytes32 specId, address cash, uint256 amt)
    public
    override {
    require(
      cash == chainlinkTokenAddress(),
      'request can only pay with link'
    );
    bytes32 tag = checkTag(oracle, specId);

    //push indexes msg.sender as src, so this adapter can only push to its 
    //own feeds.  since adapter can't push to oracle's feed, tag has to index
    //oracle and specId.
    //create a new tag from (oracle, specId) and push to 
    //feed(address(this), tag(oracle, specId))
    fb.request(address(this), tag, cash, amt);

    //send Chainlink request to oracle
    uint256 cost = fb.getCost(address(this), tag, cash);
    if( fb.requested(address(this), tag, cash) >= cost ) {
      fb.charge(tag, cash);
      fb.withdraw(cash, address(this), cost);

      Chainlink.Request memory req = buildChainlinkRequest(
        specId,
        address(this),
        this.callback.selector
      );

      _bals[msg.sender][cash] -= amt;

      //store requestId->specId to generate tag on callback
      bytes32 reqId = sendChainlinkRequestTo( oracle, req, cost );
      reqToSpec[reqId] = specId;
    }
  }

  function requested(address oracle, bytes32 specId, address cash)
    public
    view
    override
    returns (uint256) {
    require(
      cash == chainlinkTokenAddress(),
      'request can only pay with link'
    );
    bytes32 tag = _tags[oracle][specId];
    require( tag != bytes32(0), 'requested: invalid oracle,specId pair' );

    return fb.requested(address(this), tag, cash);
  }

  //oracle calls this when fulfilling a request
  //push the data to feedbase and delete requestId->specId entry
  function callback(bytes32 requestId, bytes32 data) 
    public 
    recordChainlinkFulfillment(requestId)
    override {
    bytes32 tag = _tags[msg.sender][reqToSpec[requestId]];
    require( tag != bytes32(0), 'callback: invalid sender,reqId pair' );

    fb.push(tag, data, type(uint256).max, chainlinkTokenAddress());
    reqToSpec[requestId] = 0;
  }

  function read(address oracle, bytes32 specId)
    public
    view
    override 
    returns (bytes32 val, uint256 ttl) {
    bytes32 tag = _tags[oracle][specId];
    require( tag != bytes32(0), 'read: invalid oracle,specId pair' );

    (val, ttl) = fb.read(address(this), tag);
  }

  function balances(address cash, address who) public view returns (uint) {
    return _bals[who][cash];
  }

  function tags(address oracle, bytes32 specId) public view returns (bytes32) {
    return _tags[oracle][specId];
  }

  function checkTag(address oracle, bytes32 specId) private returns (bytes32 tag) {
    require( oracle != address(0), 'ERR_INV_ORACLE' );
    require( specId != bytes32(0), 'ERR_INV_SPECID' );
    tag = _tags[oracle][specId];
    if( tag == bytes32(0) ) {
      tag = bytes32(nonce++);
      _tags[oracle][specId] = tag;
    }
  }
}
