const dpack = require('dpack')
const sensor = require('./src/sensor')
const { makeUpdateDigest } = require('./src/message')

let dapp

export async function init () {
  dapp = await dpack.loadFromFile('./dist/feedbase-full-pack.json')
}

module.exports = {
  dapp,
  sensor,
  makeUpdateDigest
}
