// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.1;

import './Feedbase.sol';

contract OracleFactory {
  uint public chainId;
  Feedbase public feedbase;
  mapping(address=>bool) public builtHere;

  event CreateOracle(address indexed oracle);

  constructor(Feedbase fb, uint chainId_) {
    feedbase = fb;
    chainId = chainId_;
  }

  function create() public returns (Oracle) {
    Oracle o = new Oracle(feedbase, msg.sender, chainId);
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

  uint256                  public chainId;
  bytes32                  public DOMAIN_SEPARATOR;

  event OwnerUpdate(address indexed oldOwner, address indexed newOwner);
  event SignerUpdate(address indexed signer, uint signerTTL);

  event Relay(
      address indexed relayer
    , address indexed signer
    , bytes32 indexed tag
    , bytes32         val
    , uint64          ttl
  );

  // bytes32 public constant RELAY_TYPEHASH = keccak256("Relay(uint256 tag,uint256 val,uint256 ttl)");
  bytes32 public constant RELAY_TYPEHASH = 0x01383e2717f2f89382ed7c1861448f727a0f088adef583f883b9e76325da7f3c;

  constructor(Feedbase fb, address owner_, uint chainId_) {
    feedbase = fb;
    owner = owner_;
    chainId = chainId_;
    string memory version = "1";
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256("Feedbase"),
      keccak256(bytes(version)),
      chainId_,
      address(this)
    ));
  }

  // caller grabs signed message from meta['url']
  function relay(bytes32 tag, bytes32 val, uint64 ttl, uint8 v, bytes32 r, bytes32 s) public {
    // ecrecover
    // verify signer key is live for this signer/ttl
    require(block.timestamp < ttl, 'oracle-push-bad-msg-ttl');

    bytes32 digest =
      keccak256(abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(RELAY_TYPEHASH, tag, val, ttl))
    ));
    address signer = ecrecover(digest, v, r, s);
    uint sttl = signerTTL[signer];
    require(block.timestamp < sttl, 'oracle-push-bad-key-ttl');

    emit Relay(msg.sender, signer, tag, val, ttl);
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


