import path from 'path'
import * as dpack from 'dpack'
import * as sensor from './sensor'
import { makeUpdateDigest } from './message'
import * as format from './format'
import * as autofeed from './autofeed'

let dapp

async function init() {
  console.log('WARN hard coded packfile')
  const packfile = path.join(__dirname, '../dpacks/feedbase.json')
  dapp = await dpack.loadFromFile(packfile)
}

export {
  init,
  dapp,
  sensor,
  makeUpdateDigest,
  format,
  autofeed
}
