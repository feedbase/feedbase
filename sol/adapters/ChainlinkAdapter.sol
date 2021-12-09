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

contract ChainlinkAdapter is ChainlinkClient, ConfirmedOwner {
  struct TagConfig {
    address oracle;
    bytes32 job;
    uint256 fee;
  }

  // _tags     :: oracle -> specId -> tag
  mapping(address=>mapping(bytes32=>bytes32)) _tags;
  // reqToSpec :: reqId -> specId
  mapping(bytes32=>bytes32) public reqToTag;
  // _config   :: tag -> TagConfig
  mapping(bytes32=>TagConfig) _config;
  // _bals     :: src -> cash -> balance
  mapping(address=>mapping(address=>uint256)) _bals;
  uint256 nonce = 1;
  Feedbase fb;

  constructor(address _LINK, address _fb, address _owner) ConfirmedOwner(_owner) {
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
  
  function setCost(bytes32 tag, address cash, uint256 cost) public {
    require( msg.sender == owner(), 'setCost: permission denied' );
    require( cash == chainlinkTokenAddress(), 'can only setCost link' );
    fb.setCost(tag, cash, cost);
  }

  function getCost(bytes32 tag, address cash)
    public
    view
    returns (uint256) {
    return fb.getCost(address(this), tag, cash);
  }

  //specId = Chainlink Job Specification Id
  function request(bytes32 tag, address cash, uint256 amt) public {
    require(
      cash == chainlinkTokenAddress(),
      'request can only pay with link'
    );
    TagConfig storage tagConf = _config[tag];
    address oracle = tagConf.oracle;
    bytes32 specId = tagConf.job;

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
      reqToTag[reqId] = tag;
    }
  }

  function requested(address src, bytes32 tag, address cash)
    public
    view
    returns (uint256) {
    require(
      cash == chainlinkTokenAddress(),
      'request can only pay with link'
    );
    return fb.requested(src, tag, cash);
  }

  //oracle calls this when fulfilling a request
  //push the data to feedbase and delete requestId->specId entry
  function callback(bytes32 requestId, bytes32 data) 
    public 
    recordChainlinkFulfillment(requestId) {

    bytes32 tag = reqToTag[requestId];
    require( tag != bytes32(0), 'ERR_REQ_TAG' );

    fb.push(tag, data, type(uint256).max, chainlinkTokenAddress());
    reqToTag[requestId] = bytes32(0);
  }

  function read(bytes32 tag)
    public
    view 
    returns (bytes32 val, uint256 ttl) {
    (val, ttl) = fb.read(address(this), tag);
  }

  function balances(address cash, address who) public view returns (uint) {
    return _bals[who][cash];
  }

  function addTag(bytes32 tag, address oracle, bytes32 specId, uint256 fee) public {
    TagConfig storage config = _config[tag];
    config.oracle = oracle;
    config.job = specId;
    config.fee = fee;
    // TODO: emit tag added event
  }
}

contract ChainlinkAdapterFactory {
  mapping(address=>bool) public builtHere;
  address public link;
  address public fb;

  constructor(address _LINK, address _fb) {
    link = _LINK;
    fb = _fb;
  }

  function build() public returns (ChainlinkAdapter) {
    ChainlinkAdapter cla = new ChainlinkAdapter(link, fb, msg.sender);
    return cla;
  }
}