const path = require('path')
const dpack = require('dpack')
const sensor = require('./sensor')
const { makeUpdateDigest } = require('./message')
const format = require('./format')
const autofeed = require('./autofeed')

let dapp

async function init () {
  const packfile = path.join(__dirname, '../dpacks/feedbase-full-pack.json')
  dapp = await dpack.loadFromFile(packfile)
}

export {
  init,
  dapp,
  sensor,
  makeUpdateDigest,
  format,
  autofeed,
}
