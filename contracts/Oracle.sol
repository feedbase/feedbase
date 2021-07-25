// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.1;

import './Feedbase.sol';

import "hardhat/console.sol";

contract OracleFactory {
  Feedbase public feedbase;
  mapping(address=>bool) public builtHere;

  event BuiltOracle(address indexed oracle);

  constructor(Feedbase fb) {
    feedbase = fb;
  }

  function build() public returns (Oracle) {
    Oracle o = new Oracle(feedbase);
    builtHere[address(o)] = true;
    emit BuiltOracle(address(o));
    o.setOwner(msg.sender);
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
    , uint64  indexed seq
  ) anonymous ;

  // bytes32 public constant SUBMIT_TYPEHASH = keccak256("Submit(bytes32 tag,uint64 seq,uint64 sec,uint64 ttl,bytes val)");
  bytes32 public constant SUBMIT_TYPEHASH = 0xdfa52e6a623d10ed1fca316f9b63ebce6ae0d73a5b7d160596cf2eede243171a;

  constructor(Feedbase fb) {
    feedbase = fb;
    owner = msg.sender;

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

  function submit(
    bytes32 tag,
    uint64 seq,
    uint64 sec,
    uint64 ttl,
    bytes calldata val,
    uint8 v, bytes32 r, bytes32 s
  ) public
  {
    // verify signer key is live for this signer/ttl
    require(block.timestamp < ttl, 'oracle-submit-msg-ttl');

    // EIP712 digest
    string memory header = "\x19Ethereum Signed Message:\n32";
    bytes32 digest = keccak256(abi.encodePacked(header, 
      keccak256(abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          SUBMIT_TYPEHASH, 
          tag, 
          seq,
          sec,
          ttl,
          keccak256(val)
        ))
      ))
    ));

    address signer = ecrecover(digest, v, r, s);

    uint sttl = signerTTL[signer];
    require(block.timestamp < sttl, 'oracle-submit-bad-signer');

    emit Submit(msg.sender, signer, tag, seq);
    feedbase.push(tag, seq, sec, ttl, val);
  }

  function configFeed(bytes32 tag, address cash, uint cost, string calldata desc) public {
    require(msg.sender == owner, 'oracle-configFeed-bad-owner');
    feedbase.config(tag, cash, cost, desc);
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


