const debug = require('debug')('feedbase:util')

const ethers = require('ethers')
const dpack = require('./dpack')

export async function load (env: any) {
  if (!env.DEPLOYER_PRIVATE_KEY) {
    throw new Error('No env.DEPLOYER_PRIVATE_KEY provided')
  }
  if (!env.NETWORK) {
    throw new Error('No env.NETWORK provided')
  }

  console.log('WARN hard coded packfile')
  const path = require('path').join(__dirname, '../dpacks/feedbase.json')

  debug(dpack)
  const dapp = await dpack.loadFromFile(path)
  debug(dapp)
  dapp.useProvider(ethers.getDefaultProvider(env.NETWORK))
  dapp.useSigner(new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY))
  return dapp
}
