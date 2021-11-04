import { autofeed } from '../autofeed'

export const getter = autofeed({
  url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
  jqs: '.ethereum.usd',
  ops: 'toNumber toWei toBytes32'
})
