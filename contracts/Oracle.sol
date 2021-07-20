pragma solidity ^0.8.1;

import './Feedbase.sol';

contract OracleFactory {
  Feedbase fb;
  mapping(address=>bool) builtHere;
  event CreateOracle(address indexed oracle);
  constructor(Feedbase feedbase) {
    fb = feedbase;
  }
  function create() public returns (Oracle) {
    Oracle o = new Oracle(fb);
    builtHere[address(o)] = true;
    emit CreateOracle(address(o));
    return new Oracle(fb);
  }
}

contract Oracle {
  struct Update {
    bytes32 key;
    bytes32 value;
    uint64  ttl;
  }

  Feedbase               public feedbase;
  address                public owner;
  mapping(address=>uint) public signerTTL; // isSigner

  mapping(bytes32=>string) public config;

  constructor(Feedbase fb) {
    feedbase = fb;
  }

  // caller grabs signed message from url
  function relay(Update calldata update, uint v, uint r, uint s) public {
    // ecrecover
    // verify signer key is live for this signer/ttl
    require(block.timestamp < update.ttl, 'oracle-push-bad-msg-ttl');

    // TODO EIP712 compliant
    bytes32 digest = keccak256(abi.encode(update));
    address signer = ecrecover(digest, 0, 0, 0);
    uint sttl = signerTTL[signer];
    require(block.timestamp < sttl, 'oracle-push-bad-key-ttl');

    feedbase.push(update.key, update.value, update.ttl);
  }

  function setOwner(address newOwner) public {
    require(msg.sender == owner, 'oracle-give-bad-owner');
    owner = newOwner;
  }

  function setSigner(address who, uint ttl) public {
    require(msg.sender == owner, 'oracle-setSigner-bad-owner');
    signerTTL[who] = ttl;
  }
  function isSigner(address who) public view returns (bool) {
    return block.timestamp < signerTTL[who];
  }

  // e.g. setConfig('url', 'https://.....');
  function setConfig(bytes32 key, string calldata value) public {
    require(msg.sender == owner, 'oracle-setSigner-bad-owner');
    config[key] = value;
  }
}


