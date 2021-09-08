import { ethers } from 'ethers'

const debug = require('debug')('feedbase:sensor')

const http = require('http')

const { makeUpdateDigest } = require('./index')

console.warn('WARN using delayed time')
const now = () => Math.floor(Date.now() / 1000) - 500 // WARN

class Sensor {
  tag: Buffer = Buffer.alloc(32)
  seq: number = 0
  sec: number = now()
  ttl: number = now() + 600
  val: Buffer = Buffer.alloc(32)
  sig: string = ''

  chainId: number = 1
  receiver: string = '0x' + 'f'.repeat(40)
  signer: any = ethers.Wallet.createRandom()

  digest: Uint8Array = new Uint8Array()

  getter: Function

  constructor (getter: Function) {
    this.getter = getter
  }

  async refresh () {
    debug('refreshing...')
    this.val = await this.getter()
    this.sec = now()
    this.ttl = this.sec + 600
    this.seq = this.seq + 1
    this.digest = makeUpdateDigest(this)
    debug('signing...')
    this.sig = await this.signer.signMessage(this.digest)

    debug('update:')
    debug(`  tag ${this.tag.toString('hex')}`)
    debug(`  seq ${this.seq}`)
    debug(`  sec ${this.sec}`)
    debug(`  ttl ${this.ttl}`)
    debug(`  val ${this.val.toString('hex')}`)
    debug(`  sig ${this.sig}`)
  }
}

export async function serve (getter: Function, opts: any): Promise<void> {
  debug('serve', opts)
  const s = new Sensor(getter)
  s.receiver = opts.receiver
  s.chainId = opts.chainId
  s.signer = opts.signer

  await s.refresh()
  setInterval(async () => await s.refresh(), 3000)

  const server = http.createServer(async (req: any, res: any) => {
    debug('request URL', req.url)
    res.writeHead(200)
    const response = JSON.stringify({
      tag: '0x' + s.tag.toString('hex'),
      seq: s.seq,
      sec: s.sec,
      ttl: s.ttl,
      val: '0x' + s.val.toString('hex'),
      sig: s.sig,
      chainId: s.chainId,
      receiver: s.receiver
    })
    res.end(response)
  })
  const port = 8008
  console.log(`serving on port ${port}`)
  server.listen(port)
}
