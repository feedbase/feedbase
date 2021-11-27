// (c) nikolai mushegian
// SPDX-License-Identifier: AGPL-v3.0
pragma solidity ^0.8.9;

import "./Feedbase.sol";
import "@chainlink/contracts/src/v0.8/dev/ChainlinkClient.sol";
import "./erc20/IERC20.sol";

import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

interface ChainlinkAdapterInterface {
  function request(address oracle, bytes32 specId, address cash, uint256 amt) external;
  function requested(address oracle, bytes32 specId, address cash) external returns (uint256);
  function callback(bytes32 requestId, bytes32 data) external;
  function read(address oracle, bytes32 specId) external view returns (bytes32, uint256);
  function deposit(address cash, address user, uint amt) external payable;
  function withdraw(address cash, address user, uint amt) external;
}

contract ChainlinkAdapter is ChainlinkClient, ChainlinkAdapterInterface {
  mapping(address=>mapping(bytes32=>bytes32)) _tags;
  mapping(bytes32=>bytes32) public reqToSpec;
  // src -> cash -> balance
  mapping(address=>mapping(address=>uint256)) _bals;
  uint256 nonce = 1;
  Feedbase fb;
  address LINK;
  address owner;

  constructor(address _LINK, address _fb) {
    setChainlinkToken(_LINK);
    fb   = Feedbase(_fb);
    owner = msg.sender;
  }

  function deposit(address cash, address user, uint amt) public payable {
    //require( cash == LINK, 'deposit can only pay with link' );
    bool ok = IERC20(cash).transferFrom(msg.sender, address(this), amt);
    IERC20(cash).approve(address(fb), amt);
    fb.deposit(cash, address(this), amt);
    require(ok, 'ERR_DEPOSIT_PULL');
    _bals[user][cash] += amt;
  }

  function withdraw(address cash, address user, uint amt) public {
    _bals[msg.sender][cash] -= amt;
    fb.withdraw(cash, msg.sender, amt);
  }
  
  function setCost(address oracle, bytes32 specId, address cash, uint256 cost) public {
    require( msg.sender == owner, 'setCost: permission denied' );
    fb.setCost(_tags[oracle][specId], cash, cost);
  }

  function request(address oracle, bytes32 specId, address cash, uint256 amt) public override {
    require( cash == chainlinkTokenAddress(), 'request can only pay with link' );
    bytes32 tag = _tags[oracle][specId];

    if( tag == bytes32(0) ) {
      tag = bytes32(nonce++);
      _tags[oracle][specId] = tag;
    }

    fb.request(address(this), tag, cash, amt);

    uint256 cost = fb.getCost(address(this), tag, cash);
    if( fb.requested(address(this), tag, cash) >= cost ) {
      // doing all this in case feedbase is extended
      fb.charge(tag, cash);
      fb.withdraw(cash, address(this), cost);

      //convert to link
      //...

      //send request to oracle
      Chainlink.Request memory req = buildChainlinkRequest(
        specId,
        address(this),
        this.callback.selector
      );

      _bals[msg.sender][cash] -= amt;

      bytes32 reqId = sendChainlinkRequestTo( oracle, req, cost );
      reqToSpec[reqId] = specId;
    }
  }

  function requested(address oracle, bytes32 specId, address cash) public view override returns (uint256) {
    bytes32 tag = _tags[oracle][specId];
    require( tag != bytes32(0), 'requested: invalid oracle,specId pair' );

    return fb.requested(address(this), tag, cash);
  }

  function callback(bytes32 requestId, bytes32 data) 
    public 
    recordChainlinkFulfillment(requestId)
    override {
    bytes32 tag = _tags[msg.sender][reqToSpec[requestId]];
    require( tag != bytes32(0), 'callback: invalid sender,reqId pair' );

    fb.push(tag, data, type(uint256).max, chainlinkTokenAddress());
  }

  function read(address oracle, bytes32 specId) public view override returns (bytes32 val, uint256 ttl) {
    bytes32 tag = _tags[oracle][specId];
    require( tag != bytes32(0), 'read: invalid oracle,specId pair' );

    (val, ttl) = fb.read(address(this), tag);
  }

  function balances(address who, address cash) public view returns (uint) {
    return _bals[who][cash];
  }

  function tags(address oracle, bytes32 specId) public view returns (bytes32) {
    return _tags[oracle][specId];
  }
}
