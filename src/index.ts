const dpack = require('dpack')
const sensor = require('./sensor')
const { makeUpdateDigest } = require('./message')

let dapp

export async function init () {
  dapp = await dpack.loadFromFile('../dpacks/feedbase-full-pack.json')
}

module.exports = {
  dapp,
  sensor,
  makeUpdateDigest
}
