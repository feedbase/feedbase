#!/usr/bin/env ts-node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var debug = require('debug')('feedbase:main');
var fetch = require('node-fetch');
var repl = require('repl');
var fs = require('fs');
var exit = process.exit;
var prog = require('commander');
var ethers = require('ethers');
var fmt = require('./formatters');
var dpack = require('dpack');
var lib = require('./index');
var gopts;
var dapp;
prog.description('Feedbase utility');
prog.requiredOption('--network <network>', 'hardhat network config');
prog.hook('preAction', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                gopts = prog.opts();
                debug('initializing library...');
                return [4 /*yield*/, lib.init()];
            case 1:
                _a.sent();
                debug('instantiating dapp...');
                dapp = lib.dapp;
                if (gopts.network) {
                    dapp.useProvider(ethers.getDefaultProvider(gopts.network));
                }
                debug('ready');
                return [2 /*return*/];
        }
    });
}); });
prog.showHelpAfterError();
prog
    .command('repl')
    .action(function () { return __awaiter(void 0, void 0, void 0, function () {
    var r;
    return __generator(this, function (_a) {
        console.log('  Use dapp.useDefaultProvider( networkName ) to switch networks');
        console.log('  Use dapp.useSigner(new ethers.Wallet(hexPrivKey)) to switch signers');
        r = repl.start('feedbase repl > ');
        r.context.dapp = dapp;
        r.context.oracle = lib.oracle;
        return [2 /*return*/];
    });
}); });
prog
    .command('show-pack')
    .action(function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log(JSON.stringify(dapp._raw, null, 2));
        exit(0);
        return [2 /*return*/];
    });
}); });
prog
    .command('read')
    .option('--src <src>', "feed 'src' address", fmt.address)
    .option('--tag <tag>', 'feed tag', fmt.bytes32)
    .action(function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    var res;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, dapp.objects.feedbase.functions.read(opts.src, opts.tag)];
            case 1:
                res = _a.sent();
                console.log(res);
                exit(0);
                return [2 /*return*/];
        }
    });
}); });
prog
    .command('sensor.serve')
    .requiredOption('--source <source>', 'Data source module path')
    //  .requiredOption('--signer <signer>', "Message signer key address", fmt.address)
    .requiredOption('--receiver <receiver>', 'Receiver contract address', fmt.address)
    .requiredOption('--chainId <chainId>', 'Chain ID of receiver contract')
    .action(function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    var wallet, getter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                debug('opts', opts);
                if (!process.env.SENSOR_PRIVKEY) {
                    console.log('SENSOR_PRIVKEY env var is missing.');
                    exit(1);
                }
                wallet = new ethers.Wallet(process.env.SENSOR_PRIVKEY);
                debug("using signer " + wallet.address);
                opts.signer = wallet;
                getter = require(opts.source).getter;
                return [4 /*yield*/, lib.sensor.serve(getter, opts)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
prog
    .command('relay.start')
    .requiredOption('--sensor <url>', 'URL of sensor publishing signed messages')
    //  .requiredOption('--relayer <key>', "Relay transaction sender key", fmt.address)
    .requiredOption('--receiver <receiver>', 'Receiver contract address', fmt.address)
    .requiredOption('--chainId <chainId>', 'Chain ID of receiver contract')
    .option('--forceReceiver', 'Skip bytecode check for receiver contract')
    .action(function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    var wallet, receiverType, receiver, res, msg, code, split, trySubmit, tx_submit;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                debug('opts', opts);
                if (!process.env.RELAY_PRIVKEY) {
                    console.log('RELAY_PRIVKEY env var is missing.');
                    exit(1);
                }
                wallet = new ethers.Wallet(process.env.RELAY_PRIVKEY);
                dapp.useSigner(wallet);
                debug("using signer " + wallet.address);
                receiverType = dapp.types.BasicReceiver;
                receiver = receiverType.attach(opts.receiver);
                return [4 /*yield*/, fetch(opts.sensor)];
            case 1:
                res = _a.sent();
                return [4 /*yield*/, res.json()];
            case 2:
                msg = _a.sent();
                return [4 /*yield*/, dapp.provider.getCode(opts.receiver)];
            case 3:
                code = _a.sent();
                if (code != receiverType.artifacts.deployedBytecode && !opts.forceReceiver) {
                    console.log('Receiver address does not have expected bytecode.');
                    console.log('Use --forceReceiver if you know it implements `submit`.');
                    exit(1);
                }
                split = ethers.utils.splitSignature(msg.sig);
                return [4 /*yield*/, receiver.callStatic.submit(msg.tag, msg.seq, msg.sec, msg.ttl, msg.val, split.v, split.r, split.s)];
            case 4:
                trySubmit = _a.sent();
                return [4 /*yield*/, receiver.functions.submit(msg.tag, msg.seq, msg.sec, msg.ttl, msg.val, split.v, split.r, split.s)];
            case 5:
                tx_submit = _a.sent();
                return [4 /*yield*/, tx_submit.wait()];
            case 6:
                _a.sent();
                exit(0);
                return [2 /*return*/];
        }
    });
}); });
prog
    .command('receiver.create')
    .action(function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    var wallet, receiverType, fb, receiver;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                debug('opts', opts);
                if (!process.env.DEPLOY_PRIVKEY) {
                    console.log('DEPLOY_PRIVKEY env var is missing.');
                    exit(1);
                }
                wallet = new ethers.Wallet(process.env.DEPLOY_PRIVKEY);
                debug("using signer " + wallet.address);
                dapp.useSigner(wallet);
                receiverType = dapp.types.BasicReceiver;
                fb = dapp.objects.feedbase;
                if (!fb) {
                    console.log("No feedbase object known on network " + gopts.network);
                }
                console.log("Deploying new receiver from " + wallet.address);
                return [4 /*yield*/, receiverType.deploy(fb.address)
                    // debug(receiver);
                ];
            case 1:
                receiver = _a.sent();
                // debug(receiver);
                return [4 /*yield*/, receiver.deployTransaction.wait()];
            case 2:
                // debug(receiver);
                _a.sent();
                console.log("Deployed new BasicReceiver to " + receiver.address);
                exit(0);
                return [2 /*return*/];
        }
    });
}); });
prog
    .command('receiver.setSigner')
    .requiredOption('--receiver <address>', 'The receiver contract on which to set signer')
    .requiredOption('--signer <address>', 'The signer address to approve')
    .requiredOption('--ttl <ttl>', 'The expiration timestamp of this key')
    .action(function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    var wallet, receiverType, receiver, tx_setSigner, isSigner;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                debug('opts', opts);
                if (!process.env.DEPLOY_PRIVKEY) {
                    console.log('DEPLOY_PRIVKEY env var is missing.');
                    exit(1);
                }
                wallet = new ethers.Wallet(process.env.DEPLOY_PRIVKEY);
                debug("using signer " + wallet.address);
                dapp.useSigner(wallet);
                receiverType = dapp.types.BasicReceiver;
                receiver = receiverType.attach(opts.receiver);
                debug(receiver.functions);
                return [4 /*yield*/, receiver.setSigner(opts.signer, parseInt(opts.ttl))];
            case 1:
                tx_setSigner = _a.sent();
                debug(tx_setSigner);
                return [4 /*yield*/, tx_setSigner.wait()];
            case 2:
                _a.sent();
                return [4 /*yield*/, receiver.callStatic.isSigner(opts.signer)];
            case 3:
                isSigner = _a.sent();
                debug(isSigner);
                if (!isSigner) {
                    console.log('Transaction succeeded, but the address is still not a signer (likely bad TTL).');
                    exit(1);
                }
                exit(0);
                return [2 /*return*/];
        }
    });
}); });
prog
    .command('autofeed')
    .requiredOption('--url <url>', 'URL of JSON')
    .requiredOption('--jqs <jqs>', 'JQ string')
    .requiredOption('--ops <ops>', 'Postprocessing string')
    .requiredOption('--receiver <receiver>', 'Receiver contract address', fmt.address)
    .requiredOption('--chainId <chainId>', 'Chain ID of receiver contract')
    .action(function (opts) { return __awaiter(void 0, void 0, void 0, function () {
    var wallet, autofeed, getter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                debug('opts', opts);
                if (!process.env.SENSOR_PRIVKEY) {
                    console.log('SENSOR_PRIVKEY env var is missing.');
                    exit(1);
                }
                wallet = new ethers.Wallet(process.env.SENSOR_PRIVKEY);
                debug("using signer " + wallet.address);
                opts.signer = wallet;
                autofeed = require('./lib/autofeed').autofeed;
                getter = autofeed({
                    url: opts.url, jqs: opts.jqs, ops: opts.ops
                });
                return [4 /*yield*/, lib.sensor.serve(getter, opts)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
prog.parseAsync(process.argv);
