const dpack = require('dpack')
const sensor = require('./sensor')
const { makeUpdateDigest } = require('./message')

let dapp

async function init () {
  dapp = await dpack.loadFromFile('../dpacks/feedbase-full-pack.json')
}

export {
  init,
  dapp,
  sensor,
  makeUpdateDigest
}
