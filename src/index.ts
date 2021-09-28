const path = require('path')
const dpack = require('dpack')
const sensor = require('./sensor')
const { makeUpdateDigest } = require('./message')
const format = require('./format')
const autofeed = require('./autofeed')

let dapp

async function init () {
  console.log("WARN hard coded packfile")
  const packfile = path.join(__dirname, '../dpacks/feedbase.json')
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

