// (c) nikolai mushegian
// SPDX-License-Identifier: AGPL-v3.0

pragma solidity ^0.8.9;

import "./Feedbase.sol";
import "@chainlink/contracts/src/v0.8/dev/ChainlinkClient.sol";


interface ChainlinkAdapterInterface {
  // require cash==LINK
  function request(address oracle, bytes32 specId, address cash, uint256 amt) external;
  function requested(address oracle, bytes32 specId, address cash) external returns (uint256);
  function callback(bytes32 requestId, bytes32 data) external;
  function read(address oracle, bytes32 specId) external returns (bytes32, uint256);

  function deposit(address cash, address user, uint amt) external payable;
  function withdraw(address cash, address user, uint amt) external;
}

// extends ChainlinkClient
contract ChainlinkAdapter is ChainlinkClient, ChainlinkAdapterInterface {
  mapping(address=>mapping(bytes32=>bytes32)) tags;
  mapping(bytes32=>bool) built;
  mapping(bytes32=>bytes32) reqToSpec;
  uint256 nonce = 1;
  address LINK;
  mapping(address=>uint256) bals;
  Feedbase fb;

  // _bals   :: tag -> balance
  mapping(address=>mapping(address=>uint256)) public _bals;
 

  constructor(address _LINK, address _fb) public {
    LINK = _LINK;
    fb   = Feedbase(_fb);
  }

  function deposit(address cash, address user, uint amt) public payable {
    require( cash == LINK, 'request can only pay with link' );
    bool ok = IERC20(cash).transferFrom(msg.sender, address(this), amt);
    require(ok, 'ERR_DEPOSIT_PULL');
    bals[user] += amt;
    fb.deposit(cash, address(this), amt);
  }

  function withdraw(address cash, address user, uint amt) public {
    bals[msg.sender] -= amt;
    fb.withdraw(cash, user, amt);
  }

  function request(address oracle, bytes32 specId, address cash, uint256 amt) public override {
    require( cash == LINK, 'request can only pay with link' );
    bytes32 tag = tags[oracle][specId];
    if( tag == bytes32(0) ) {
      tag = bytes32(nonce++);
      tags[oracle][specId] = tag;
    }

    bals[msg.sender] -= amt;
    fb.request(address(this), tag, cash, amt);

    if( reqToSpec[tag] != bytes32(0) ) {
      Chainlink.Request memory req = buildChainlinkRequest(
        specId,
        address(this),
        this.callback.selector
      );

      bytes32 reqId = sendChainlinkRequestTo( oracle, req, amt );
      reqToSpec[reqId] = tag;
    }
  }

  function requested(address oracle, bytes32 specId, address cash) public override returns (uint256) {
    bytes32 tag = tags[oracle][specId];
    require( tag != bytes32(0), 'requested: invalid oracle,specId pair' );

    return fb.requested(address(this), tag, cash);
  }

  function callback(bytes32 requestId, bytes32 data) 
    public 
    override {
    validateChainlinkCallback(requestId);
    bytes32 tag = tags[msg.sender][reqToSpec[requestId]];
    require( tag != bytes32(0), 'callback: invalid sender,reqId pair' );

    fb.push(tag, data, type(uint256).max, LINK);
  }

  function read(address oracle, bytes32 specId) public override returns (bytes32 val, uint256 ttl) {
    bytes32 tag = tags[oracle][specId];
    require( tag != bytes32(0), 'read: invalid oracle,specId pair' );

    return fb.read(address(this), tag);
  }
}
