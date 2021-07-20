// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.1;

import './Feedbase.sol';

contract OracleFactory {
  Feedbase public feedbase;
  mapping(address=>bool) public builtHere;

  event CreateOracle(address indexed oracle);

  constructor(Feedbase fb) {
    feedbase = fb;
  }

  function create() public returns (Oracle) {
    Oracle o = new Oracle(feedbase);
    builtHere[address(o)] = true;
    emit CreateOracle(address(o));
    return o;
  }
}

contract Oracle {
  Feedbase                 public feedbase;
  address                  public owner;
  mapping(address=>uint)   public signerTTL; // isSigner

  mapping(bytes32=>string) public meta;

  event OwnerUpdate(address indexed oldOwner, address indexed newOwner);
  event SignerUpdate(address indexed signer, uint signerTTL);

  event Relay(
      address indexed signer
    , address indexed relayer
    , bytes32 indexed tag
    , bytes32         val
    , uint64          ttl
  );

  constructor(Feedbase fb) {
    feedbase = fb;
    owner = msg.sender;
  }

  // caller grabs signed message from meta['url']
  function relay(bytes32 tag, bytes32 val, uint64 ttl, uint8 v, bytes32 r, bytes32 s) public {
    // ecrecover
    // verify signer key is live for this signer/ttl
    require(block.timestamp < ttl, 'oracle-push-bad-msg-ttl');

    // TODO EIP712 compliant
    bytes32 digest = keccak256(abi.encode(tag, val, ttl));
    address signer = ecrecover(digest, v, r, s);
    uint sttl = signerTTL[signer];
    require(block.timestamp < sttl, 'oracle-push-bad-key-ttl');

    emit Relay(signer, msg.sender, tag, val, ttl);
    feedbase.push(tag, val, ttl);
  }

  function setOwner(address newOwner) public {
    require(msg.sender == owner, 'oracle-give-bad-owner');
    OwnerUpdate(owner, newOwner);
    owner = newOwner;
  }

  function setSigner(address who, uint ttl) public {
    require(msg.sender == owner, 'oracle-setSigner-bad-owner');
    signerTTL[who] = ttl;
  }
  function isSigner(address who) public view returns (bool) {
    return block.timestamp < signerTTL[who];
  }

  // e.g. setMeta('url', 'https://.....');
  function setMeta(bytes32 metaKey, string calldata metaVal) public {
    require(msg.sender == owner, 'oracle-setMeta-bad-owner');
    meta[metaKey] = metaVal;
  }
}


