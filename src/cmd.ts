#!/usr/bin/env ts-node

const debug = require('debug')('feedbase:main')

const fetch = require('node-fetch')
const repl = require('repl')
const fs = require('fs')
const exit = process.exit

const prog = require('commander')
const ethers = require('ethers')
const fmt = require('./format')

const dpack = require('dpack')
const lib = require('./index')

let gopts: any
let dapp: any

prog.description('Feedbase utility')
prog.requiredOption('--network <network>', 'hardhat network config')
prog.hook('preAction', async () => {
  gopts = prog.opts()
  debug('initializing library...')
  await lib.init()
  debug('instantiating dapp...')
  dapp = lib.dapp
  if (gopts.network) {
    dapp.useProvider(ethers.getDefaultProvider(gopts.network))
  }
  debug('ready')
})
prog.showHelpAfterError()

prog
  .command('repl')
  .action(async () => {
    console.log('  Use dapp.useDefaultProvider( networkName ) to switch networks')
    console.log('  Use dapp.useSigner(new ethers.Wallet(hexPrivKey)) to switch signers')
    const r = repl.start('feedbase repl > ')
    r.context.dapp = dapp
    r.context.oracle = lib.oracle
  })

prog
  .command('show-pack')
  .action(async (opts: any) => {
    console.log(JSON.stringify(dapp._raw, null, 2))
    exit(0)
  })

prog
  .command('read')
  .option('--src <src>', "feed 'src' address", fmt.address)
  .option('--tag <tag>', 'feed tag', fmt.str2b32)
  .action(async (opts: any) => {
    const res = await dapp.objects.feedbase.functions.read(opts.src, opts.tag)
    console.log(res)
    exit(0)
  })

prog
  .command('sensor.serve')
  .requiredOption('--source <source>', 'Data source module path')
//  .requiredOption('--signer <signer>', "Message signer key address", fmt.address)
  .requiredOption('--receiver <receiver>', 'Receiver contract address', fmt.address)
  .requiredOption('--chainId <chainId>', 'Chain ID of receiver contract')
  .action(async (opts: any) => {
    debug('opts', opts)
    if (!process.env.SENSOR_PRIVKEY) {
      console.log('SENSOR_PRIVKEY env var is missing.')
      exit(1)
    }
    const wallet = new ethers.Wallet(process.env.SENSOR_PRIVKEY)
    debug(`using signer ${wallet.address}`)
    opts.signer = wallet
    const { getter } = require(opts.source)
    await lib.sensor.serve(getter, opts)
  })

prog
  .command('relay.start')
  .requiredOption('--sensor <url>', 'URL of sensor publishing signed messages')
//  .requiredOption('--relayer <key>', "Relay transaction sender key", fmt.address)
  .requiredOption('--receiver <receiver>', 'Receiver contract address', fmt.address)
  .requiredOption('--chainId <chainId>', 'Chain ID of receiver contract')
  .option('--forceReceiver', 'Skip bytecode check for receiver contract')
  .action(async (opts: any) => {
    debug('opts', opts)
    if (!process.env.RELAY_PRIVKEY) {
      console.log('RELAY_PRIVKEY env var is missing.')
      exit(1)
    }

    const wallet = new ethers.Wallet(process.env.RELAY_PRIVKEY)
    dapp.useSigner(wallet)
    debug(`using signer ${wallet.address}`)

    const receiverType = dapp.types.BasicReceiver
    const receiver = receiverType.attach(opts.receiver)

    const res = await fetch(opts.sensor)
    const msg = await res.json()

    const code = await dapp.provider.getCode(opts.receiver)

    if (code != receiverType.artifacts.deployedBytecode && !opts.forceReceiver) {
      console.log('Receiver address does not have expected bytecode.')
      console.log('Use --forceReceiver if you know it implements `submit`.')
      exit(1)
    }

    const split = ethers.utils.splitSignature(msg.sig)

    const trySubmit = await receiver.callStatic.submit(
      msg.tag, msg.seq, msg.sec, msg.ttl, msg.val, split.v, split.r, split.s
    )

    const tx_submit = await receiver.functions.submit(
      msg.tag, msg.seq, msg.sec, msg.ttl, msg.val, split.v, split.r, split.s
    )
    await tx_submit.wait()

    exit(0)
  })

prog
  .command('receiver.create')
  .action(async (opts: any) => {
    debug('opts', opts)
    let wallet: any
    if (!process.env.DEPLOY_PRIVKEY) {
      console.log('DEPLOY_PRIVKEY env var is missing.')
      exit(1)
    }
    wallet = new ethers.Wallet(process.env.DEPLOY_PRIVKEY)
    debug(`using signer ${wallet.address}`)
    dapp.useSigner(wallet)

    const receiverType = dapp.types.BasicReceiver
    const fb = dapp.objects.feedbase
    if (!fb) {
      console.log(`No feedbase object known on network ${gopts.network}`)
    }

    console.log(`Deploying new receiver from ${wallet.address}`)
    const receiver = await receiverType.deploy(fb.address)
    // debug(receiver);
    await receiver.deployTransaction.wait()
    console.log(`Deployed new BasicReceiver to ${receiver.address}`)
    exit(0)
  })

prog
  .command('receiver.setSigner')
  .requiredOption('--receiver <address>', 'The receiver contract on which to set signer')
  .requiredOption('--signer <address>', 'The signer address to approve')
  .requiredOption('--ttl <ttl>', 'The expiration timestamp of this key')
  .action(async (opts: any) => {
    debug('opts', opts)

    let wallet: any
    if (!process.env.DEPLOY_PRIVKEY) {
      console.log('DEPLOY_PRIVKEY env var is missing.')
      exit(1)
    }
    wallet = new ethers.Wallet(process.env.DEPLOY_PRIVKEY)
    debug(`using signer ${wallet.address}`)
    dapp.useSigner(wallet)

    const receiverType = dapp.types.BasicReceiver
    const receiver = receiverType.attach(opts.receiver)

    debug(receiver.functions)

    const tx_setSigner = await receiver.setSigner(opts.signer, parseInt(opts.ttl))
    debug(tx_setSigner)
    await tx_setSigner.wait()

    const isSigner = await receiver.callStatic.isSigner(opts.signer)
    debug(isSigner)
    if (!isSigner) {
      console.log('Transaction succeeded, but the address is still not a signer (likely bad TTL).')
      exit(1)
    }

    exit(0)
  })

prog
  .command('autofeed')
  .requiredOption('--url <url>', 'URL of JSON')
  .requiredOption('--jqs <jqs>', 'JQ string')
  .requiredOption('--ops <ops>', 'Postprocessing string')
  .requiredOption('--receiver <receiver>', 'Receiver contract address', fmt.address)
  .requiredOption('--chainId <chainId>', 'Chain ID of receiver contract')
  .action(async (opts: any) => {
    debug('opts', opts)
    if (!process.env.SENSOR_PRIVKEY) {
      console.log('SENSOR_PRIVKEY env var is missing.')
      exit(1)
    }

    const wallet = new ethers.Wallet(process.env.SENSOR_PRIVKEY)
    debug(`using signer ${wallet.address}`)
    opts.signer = wallet

    const getter = lib.autofeed({
      url: opts.url, jqs: opts.jqs, ops: opts.ops
    })

    await lib.sensor.serve(getter, opts)
  })

prog.parseAsync(process.argv)

export {}
