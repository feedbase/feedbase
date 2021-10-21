const debug = require('debug')('feedbase:format')

import { utils, BigNumber } from 'ethers'
const fmt = require('..').format

describe('feedbase format utils', () => {
  it('bytes32', () => {
    const n = BigNumber.from(100)
    debug(n)
    const b = fmt.bn2b32(n)
    debug(b)
  })
})
