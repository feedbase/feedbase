const debug = require('debug')('feedbase:message')

const { TypedDataUtils } = require('ethers-eip712')

// makeUpdateDigest({
//  tag, val, ttl, chainId, receiver
// });
module.exports = {
  makeUpdateDigest: (obj) => {
    const typedData = {
      types: {
        EIP712Domain: [
          {name: "name", type: "string"},
          {name: "version", type: "string"},
          {name: "chainId", type: "uint256"},
          {name: "verifyingContract", type: "address"},
        ],
        Relay: [
          {name: "tag", type: "bytes32"},
          {name: "val", type: "bytes32"},  
          {name: "ttl", type: "uint64"},
        ]
      },
      primaryType: 'Relay',
      domain: {
        name: 'Feedbase',
        version: '1',
        chainId: obj.chainId,
        verifyingContract: obj.receiver
      },
      message: {
        'tag': obj.tag,
        'val': obj.val,
        'ttl': obj.ttl
      }
    }
    const digest = TypedDataUtils.encodeDigest(typedData)
    return digest
  }
}
