// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.1;

import './Feedbase.sol';

import "hardhat/console.sol";

contract OracleFactory {
  Feedbase public feedbase;
  mapping(address=>bool) public builtHere;

  event CreateOracle(address indexed oracle);

  constructor(Feedbase fb) {
    feedbase = fb;
  }

  function create() public returns (Oracle) {
    Oracle o = new Oracle(feedbase, msg.sender);
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

  bytes32                  public DOMAIN_SEPARATOR;

  event OwnerUpdate(address indexed oldOwner, address indexed newOwner);
  event SignerUpdate(address indexed signer, uint signerTTL);

  event Submit(
      address indexed submiter
    , address indexed signer
    , bytes32 indexed tag
    , bytes32         val
    , uint64          ttl
  );

  // bytes32 public constant SUBMIT_TYPEHASH = keccak256("Submit(bytes32 tag,bytes32 val,uint64 ttl)");
  bytes32 public constant SUBMIT_TYPEHASH = 0x3005660f386f3c7f3f011a623eab9559cb5863bb2534dceadd07ab706b69edfd;

  constructor(Feedbase fb, address owner_) {
    feedbase = fb;
    owner = owner_;

    // EIP712
    string memory version = "1";
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256("Feedbase"),
      keccak256(bytes(version)),
      chainId(),
      address(this)
    ));
  }

  function chainId() public view returns (uint256) {
    return block.chainid;
  }

  function submit(bytes32 tag, bytes32 val, uint64 ttl, uint8 v, bytes32 r, bytes32 s) public {
    // verify signer key is live for this signer/ttl
    require(block.timestamp < ttl, 'oracle-submit-msg-ttl');

    // EIP712 digest
    bytes32 digest =
      keccak256(abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          SUBMIT_TYPEHASH, 
          tag, 
          val,
          ttl
        ))
    ));

    string memory header = "\x19Ethereum Signed Message:\n32";
    bytes32 check = keccak256(abi.encodePacked(header, digest));

    address signer = ecrecover(check, v, r, s);

    uint sttl = signerTTL[signer];
    require(block.timestamp < sttl, 'oracle-submit-bad-signer');

    emit Submit(msg.sender, signer, tag, val, ttl);
    feedbase.push(tag, val, ttl);
  }

  function setOwner(address newOwner) public {
    require(msg.sender == owner, 'oracle-setOwner-bad-owner');
    emit OwnerUpdate(owner, newOwner);
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


