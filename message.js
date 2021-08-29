const debug = require('debug')('feedbase:message')

const BN = require('bn.js')

const { TypedDataUtils } = require('ethers-eip712')

// makeUpdateDigest({
//  chainId, receiver,
//  tag, seq, sec, ttl, val
// });
module.exports = {
  makeUpdateDigest: (obj) => {
    debug(obj);
    const typedData = {
      types: {
        EIP712Domain: [
          {name: "name", type: "string"},
          {name: "version", type: "string"},
          {name: "chainId", type: "uint256"},
          {name: "verifyingContract", type: "address"},
        ],
        Submit: [
          {name: "tag", type: "bytes32"},
          {name: "seq", type: "uint256"},
          {name: "sec", type: "uint256"},
          {name: "ttl", type: "uint256"},
          {name: "val", type: "bytes32"},  
        ]
      },
      primaryType: 'Submit',
      domain: {
        name: 'FeedbaseBasicReceiver',
        version: '1',
        chainId: obj.chainId,
        verifyingContract: obj.receiver
      },
      message: {
        'tag': obj.tag,
        'seq': obj.seq,
        'sec': obj.sec,
        'ttl': obj.ttl,
        'val': obj.val,
      }
    }
    const digest = TypedDataUtils.encodeDigest(typedData)
    return digest
  }
}
