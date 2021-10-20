const debug = require('debug')('feedbase:autofeed')

import fetchurl from 'node-fetch'
import { execSync } from 'child_process'
import { ethers } from 'hardhat'

const { BigNumber } = ethers

let loaded = false
function checkJQ() {
  if (!loaded) {
    try {
      execSync('jq')
    } catch (e) {
      console.log('This feature requires the \'jq\' binary to be installed.')
      console.log(e)
      process.exit(1)
    }
    loaded = true
  }
}

const opdb = {
  toWei: (n: number) => {
    // 10^18 == 10^4 * 10^14
    debug('WARN toWei sanitize')
    return (BigNumber.from(n * 10000)).mul(BigNumber.from(10).pow(BigNumber.from(14)))
  },
  toBytes32: (n: any) => {
    debug('WARN toBytes32 sanitize')
    if (n instanceof BigNumber) {
      return Buffer.from(n.toHexString().padStart(64, '0'), 'hex')
    }
    throw new Error(`Unrecognized arg type for toBytes32: ${n} : ${typeof (n)}`)
  },
  toNumber: (n: string) => {
    debug('WARN toNumber sanitize')
    return parseFloat(n)
  }
}

export function filter(obj, jqs) {
  checkJQ()
  debug('jq filter', obj, jqs)
  try {
    const result = execSync(`echo '${JSON.stringify(obj)}' | jq ${jqs}`)
    return result.toString()
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

export async function jqq(url: string, jqs: string, ops: string): Promise<any> {
  checkJQ()
  const res = await fetchurl(url)
  const json = await res.json()
  debug(`url ${url}`)
  debug(`jqs ${jqs}`)
  debug(`ops ${ops}`)
  debug('json', json)
  let value = filter(json, jqs)
  debug(`jq -> ${value}`)
  if (!value || value == '') {
    throw new Error(`nothing matched jq filter: ${jqs} ${JSON.stringify(json)}`)
  }
  for (const op of ops.split(' ')) {
    if (!opdb[op]) {
      throw new Error(`No such op: ${op}`)
    }
    value = opdb[op](value)
    debug(`${op} -> ${value}`)
  }
  debug(`RESULT: ${value}`)
  debug(value)
  return value
}

// autofeed({ url, jqs, ops })
export function autofeed(args: any): Function {
  checkJQ()
  return async function (): Promise<Buffer> {
    debug(`auto getter ${args.url} ${args.jqs} ${args.ops}`)
    return jqq(args.url, args.jqs, args.ops)
  }
}
