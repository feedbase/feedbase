// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.15;

import './Feedbase.sol';

contract BasicReceiverFactory {
    Feedbase public feedbase;
    mapping(address=>bool) public built;

    event Built(address indexed caller, address indexed receiver);

    constructor(Feedbase fb) {
        feedbase = fb;
    }

    function build() public returns (BasicReceiver) {
        BasicReceiver o = new BasicReceiver(feedbase);
        built[address(o)] = true;
        emit Built(msg.sender, address(o));
        o.setOwner(msg.sender);
        return o;
    }
}

contract BasicReceiver {
    Feedbase                 public feedbase;
    address                  public owner;
    mapping(address=>bool)   public isSigner;
    mapping(bytes32=>uint)   public prevTime;

    event OwnerUpdate(address indexed oldOwner, address indexed newOwner);
    event SignerUpdate(address indexed signer, bool isSigner);

    event Submit(
        address indexed relayer
      , address indexed signer
      , bytes32 indexed tag
      , uint256 indexed sec
      , uint256         ttl
      , bytes32         val
    ) anonymous;

    bytes32 public constant SUBMIT_TYPEHASH
      = keccak256("Submit(bytes32 tag,uint256 sec,uint256 ttl,bytes32 val)");
    bytes32 public immutable DOMAIN_SEPARATOR;

    modifier auth {
        require(msg.sender == owner, 'receiver-bad-owner');
        _;
    }

    constructor(Feedbase fb) {
        feedbase = fb;
        owner = msg.sender;

        // EIP712
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("FeedbaseBasicReceiver"),
            keccak256("1"),
            chainId(),
            address(this)
       ));
    }

    function chainId() public view returns (uint256) {
        return block.chainid;
    }

    // EIP712 digest
    function digest(bytes32 tag, uint sec, uint ttl, bytes32 val) public view returns (bytes32) {
        string memory header = "\x19Ethereum Signed Message:\n32";
        bytes32 sighash = keccak256(abi.encodePacked(header,
          keccak256(abi.encodePacked(
            "\x19\x01", DOMAIN_SEPARATOR,
            keccak256(abi.encode( SUBMIT_TYPEHASH, tag, sec, ttl, val ))
          ))
        ));
        return sighash;
  }

    function submit(
        bytes32 tag,
        uint256 sec,
        uint256 ttl,
        bytes32 val,
        uint8 v, bytes32 r, bytes32 s
    ) public
    {
        bytes32 sighash = digest(tag, sec, ttl, val);
        address signer = ecrecover(sighash, v, r, s);

        require(isSigner[signer], 'receiver-submit-bad-signer');
        require(block.timestamp <  ttl, 'receiver-submit-ttl');
        require(block.timestamp >= sec, 'receiver-submit-sec');
        require(sec > prevTime[tag], 'receiver-submit-seq');
        prevTime[tag] = sec;

        emit Submit(msg.sender, signer, tag, sec, ttl, val);

        feedbase.push(tag, val, ttl);
    }

    function setOwner(address newOwner) public auth {
        emit OwnerUpdate(owner, newOwner);
        owner = newOwner;
    }

    function setSigner(address who, bool what) public auth {
        isSigner[who] = what;
    }

}
