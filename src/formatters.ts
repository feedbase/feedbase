function pad (s, n) {
  return s.padEnd(n, '\0')
}

export function bytes32 (v: any): string {
  if (typeof (v) === 'string') {
    if (!v.startsWith('0x')) {
      v = '0x' + v.padStart(64, '0')
    }
    return v
  } else {
    throw new Error(`fmt: unsupported cast to bytes32 from ${v}`)
  }
}

export function address (v: any): string {
  if (typeof (v) === 'string') {
    if (!v.startsWith('0x')) {
      v = '0x' + v.padStart(40, '0')
    }
    return v
  } else {
    throw new Error(`fmt: unsupported cast to bytes32 from ${v}`)
  }
}

export function tag (tag: string): Buffer {
  return Buffer.from(tag.padEnd(32, '\0'))
}

export function val (val: string): Buffer {
  const BN = require('bn.js')
  const _val = parseInt(val)
  const num = new BN(_val)
  let hex = num.toString(16)
  if (hex.length % 2) hex = '0' + hex
  return Buffer.from(hex, 'hex')
}

export function ttl (ttl: string): number {
  return Math.floor(Date.now() / 1000) + parseInt(ttl)
}

export function amt (amt: string): number {
  return parseInt(amt)
}

export function cost (cost: string): number {
  return parseInt(cost)
}
