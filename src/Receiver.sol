// SPDX-License-Identifier: GPL-v3.0

pragma solidity ^0.8.0;

import './Feedbase.sol';
import { Ward } from './mixin/ward.sol';

contract BasicReceiverFactory {
    Feedbase public immutable feedbase;
    mapping(address=>bool) public built;

    event Built(address indexed caller, address indexed receiver);

    constructor(Feedbase fb) {
        feedbase = fb;
    }

    function build() public returns (BasicReceiver) {
        BasicReceiver o = new BasicReceiver(feedbase);
        built[address(o)] = true;
        emit Built(msg.sender, address(o));
        o.ward(msg.sender, true);
        return o;
    }
}

contract BasicReceiver is Ward {
    error ErrSigner();
    error ErrTtl();
    error ErrSec();
    error ErrSeq();

    Feedbase                 public immutable feedbase;
    mapping(address=>bool)   public isSigner;
    mapping(bytes32=>uint)   public prevTime;

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

    constructor(Feedbase fb) {
        feedbase = fb;

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

        if (!isSigner[signer]) revert ErrSigner();
        if (block.timestamp >= ttl) revert ErrTtl();
        if (block.timestamp < sec) revert ErrSec();
        if (sec <= prevTime[tag]) revert ErrSeq();
        prevTime[tag] = sec;

        emit Submit(msg.sender, signer, tag, sec, ttl, val);

        feedbase.push(tag, val, ttl);
    }

    function setSigner(address who, bool what) public _ward_ {
        isSigner[who] = what;
    }
}
