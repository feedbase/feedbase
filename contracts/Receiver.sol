// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.6;

import './Feedbase.sol';

contract BasicReceiverFactory {
  Feedbase public feedbase;
  mapping(address=>bool) public builtHere;

  event BuiltBasicReceiver(address indexed receiver);

  constructor(Feedbase fb) {
    feedbase = fb;
  }

  function build() public returns (BasicReceiver) {
    BasicReceiver o = new BasicReceiver(feedbase);
    builtHere[address(o)] = true;
    emit BuiltBasicReceiver(address(o));
    o.setOwner(msg.sender);
    return o;
  }
}

contract BasicReceiver {
  Feedbase                 public feedbase;
  address                  public owner;
  mapping(address=>uint)   public signerTTL; // isSigner
  mapping(address=>uint)   public signerSeq;

  // relayer's flat fee  
  // tag -> cash -> cost
  mapping(bytes32=>mapping(address=>uint)) public fees;
  // relayer -> cash -> collected
  mapping(address=>mapping(address=>uint)) public collected;

  bytes32                  public DOMAIN_SEPARATOR;

  event OwnerUpdate(address indexed oldOwner, address indexed newOwner);
  event SignerUpdate(address indexed signer, uint signerTTL);

  event Submit(
      address indexed submiter
    , address indexed signer
    , bytes32 indexed tag
    , uint256  indexed seq
  ) anonymous;

  // bytes32 public constant SUBMIT_TYPEHASH = keccak256("Submit(bytes32 tag,uint256 seq,uint256 sec,uint256 ttl,bytes32 val)");
  bytes32 public constant SUBMIT_TYPEHASH = 0x704ca89a84579f1c77f8af3ba18d619ac3bfe3ef4b477dd428170b1a3984c5d0;

  constructor(Feedbase fb) {
    feedbase = fb;
    owner = msg.sender;

    // EIP712
    string memory version = "1";
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256("FeedbaseBasicReceiver"),
      keccak256(bytes(version)),
      chainId(),
      address(this)
    ));
  }

  function chainId() public view returns (uint256) {
    return block.chainid;
  }

  // EIP712 digest
  function digest(bytes32 tag, uint seq, uint sec, uint ttl, bytes32 val) public view returns (bytes32) {
    string memory header = "\x19Ethereum Signed Message:\n32";
    bytes32 sighash = keccak256(abi.encodePacked(header, 
      keccak256(abi.encodePacked(
        "\x19\x01", DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          SUBMIT_TYPEHASH, tag, seq, sec, ttl, val
        ))
      ))
    ));
    return sighash;
  }

  function submit(
    bytes32 tag,
    uint256 seq,
    uint256 sec,
    uint256 ttl,
    bytes32 val,
    address cash,
    uint8 v, bytes32 r, bytes32 s
  ) public
  {
    // verify signer key is live for this signer/ttl
    require(block.timestamp < ttl, 'receiver-submit-msg-ttl');

    bytes32 sighash = digest(tag, seq, sec, ttl, val);
    address signer = ecrecover(sighash, v, r, s);

    uint sttl = signerTTL[signer];
    require(block.timestamp < sttl, 'receiver-submit-bad-signer');

    require(seq > signerSeq[signer], 'receiver-submit-seq');
    require(block.timestamp >= sec, 'receiver-submit-sec');
    require(block.timestamp <  ttl, 'receiver-submit-ttl');

    emit Submit(msg.sender, signer, tag, seq);

    uint paid = feedbase.push(tag, val, ttl, cash);

    uint fee = fees[tag][cash];
    if (paid < fee) {
      fee = paid;
    }
    collected[msg.sender][cash] += fee;
  }

  function collect(address cash) public {
    uint bal = collected[msg.sender][cash];
    collected[msg.sender][cash] = 0;
    if (cash == address(0)) {
      (bool ok, ) = msg.sender.call{value:bal}("");
      require(ok, 'ERR_WITHDRAW_CALL');
    } else {
      bool ok = IERC20(cash).transfer(msg.sender, bal);
      require(ok, 'ERR_ERC20_PUSH');
    }
  }

  function setCost(bytes32 tag, address cash, uint cost) public {
    require(msg.sender == owner, 'receiver-setCost-bad-owner');
    feedbase.setCost(tag, cash, cost);
  }

  function setRelayFee(bytes32 tag, address cash, uint256 fee) public {
    require(msg.sender == owner, 'receiver-setRelayFee-bad-owner');
    fees[tag][cash] = fee;
  }

  function setOwner(address newOwner) public {
    require(msg.sender == owner, 'receiver-setOwner-bad-owner');
    emit OwnerUpdate(owner, newOwner);
    owner = newOwner;
  }

  function setSigner(address who, uint ttl) public {
    require(msg.sender == owner, 'receiver-setSigner-bad-owner');
    signerTTL[who] = ttl;
  }

  function isSigner(address who) public view returns (bool) {
    return block.timestamp < signerTTL[who];
  }

}
