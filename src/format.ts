const debug = require('debug')('feedbase:format')

import { ethers } from 'hardhat'
const { BigNumber } = ethers

function pad(s, n) {
  return s.padEnd(n, '\0')
}

export function str2b32(s: string): Buffer {
  return Buffer.from(ethers.utils.zeroPad(Buffer.from(s), 32))
}

// BigNumber to `bytes32`-compatible Bytes
export function bn2b32(bn: typeof BigNumber): Buffer {
  if (!BigNumber.isBigNumber(bn)) {
    throw new Error(`bn2b32 takes a BigNumber, got ${bn}, a ${typeof (bn)}`)
  }
  const hex = bn.toHexString()
  const buff = Buffer.from(hex.slice(2), 'hex')
  const b32 = ethers.utils.zeroPad(buff, 32)
  debug(b32)
  // TODO: zeropad before creating buff?
  return Buffer.from(b32)
}

export function address(v: any): string {
  if (typeof (v) === 'string') {
    if (!v.startsWith('0x')) {
      v = '0x' + v.padStart(40, '0')
    }
    return v
  } else {
    throw new Error(`fmt: unsupported cast to bytes32 from ${v}`)
  }
}

export function tag(s: string): Buffer {
  return Buffer.from(s.padEnd(32, '\0'))
}

export function val(s: string): Buffer {
  const num = BigNumber.from(s)
  let hex = num.toHexString()
  if (hex.length % 2) hex = '0' + hex
  return Buffer.from(hex, 'hex')
}

export function ttl(l: string): number {
  return Math.floor(Date.now() / 1000) + parseInt(l)
}

export function amt(x: string): number {
  return parseInt(x)
}

export function cost(x: string): number {
  return parseInt(x)
}
