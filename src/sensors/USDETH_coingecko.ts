const { autofeed } = require('../autofeed')

export const getter = autofeed({
  url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  jqs: '.ethereum.usd',
  ops: 'toNumber toWei toBytes32'
})

/*
export async function getter (): Promise<Buffer> {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
  const res = await fetch(url)
  const body = await res.json()
  debug(body.ethereum.usd)

  return await Promise.resolve(formatPrice(body.ethereum.usd))
}

function formatPrice (price: number): Buffer {
  // 10^18 == 10^2 * 10^16
  const USDETH100 = price * 100
  const _usdeth100 = new BN(USDETH100)
  const num = _usdeth100.mul((new BN(10)).pow(new BN(16)))
  const hex = num.toString(16)
  return Buffer.from(hex, 'hex')
}
*/
