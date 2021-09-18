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
exports.serve = void 0;
var ethers_1 = require("ethers");
var debug = require('debug')('feedbase:sensor');
var http = require('http');
var makeUpdateDigest = require('./index').makeUpdateDigest;
console.warn('WARN using delayed time');
var now = function () { return Math.floor(Date.now() / 1000) - 500; }; // WARN
var Sensor = /** @class */ (function () {
    function Sensor(getter) {
        this.tag = Buffer.alloc(32);
        this.seq = 0;
        this.sec = now();
        this.ttl = now() + 600;
        this.val = Buffer.alloc(32);
        this.sig = '';
        this.chainId = 1;
        this.receiver = '0x' + 'f'.repeat(40);
        this.signer = ethers_1.ethers.Wallet.createRandom();
        this.digest = new Uint8Array();
        this.getter = getter;
    }
    Sensor.prototype.refresh = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        debug('refreshing...');
                        _a = this;
                        return [4 /*yield*/, this.getter()];
                    case 1:
                        _a.val = _c.sent();
                        this.sec = now();
                        this.ttl = this.sec + 600;
                        this.seq = this.seq + 1;
                        this.digest = makeUpdateDigest(this);
                        debug('signing...');
                        _b = this;
                        return [4 /*yield*/, this.signer.signMessage(this.digest)];
                    case 2:
                        _b.sig = _c.sent();
                        debug('update:');
                        debug("  tag " + this.tag.toString('hex'));
                        debug("  seq " + this.seq);
                        debug("  sec " + this.sec);
                        debug("  ttl " + this.ttl);
                        debug("  val " + this.val.toString('hex'));
                        debug("  sig " + this.sig);
                        return [2 /*return*/];
                }
            });
        });
    };
    return Sensor;
}());
function serve(getter, opts) {
    return __awaiter(this, void 0, void 0, function () {
        var s, server, port;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    debug('serve', opts);
                    s = new Sensor(getter);
                    s.receiver = opts.receiver;
                    s.chainId = opts.chainId;
                    s.signer = opts.signer;
                    return [4 /*yield*/, s.refresh()];
                case 1:
                    _a.sent();
                    setInterval(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, s.refresh()];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); }, 3000);
                    server = http.createServer(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var response;
                        return __generator(this, function (_a) {
                            debug('request URL', req.url);
                            res.writeHead(200);
                            response = JSON.stringify({
                                tag: '0x' + s.tag.toString('hex'),
                                seq: s.seq,
                                sec: s.sec,
                                ttl: s.ttl,
                                val: '0x' + s.val.toString('hex'),
                                sig: s.sig,
                                chainId: s.chainId,
                                receiver: s.receiver
                            });
                            res.end(response);
                            return [2 /*return*/];
                        });
                    }); });
                    port = 8008;
                    console.log("serving on port " + port);
                    server.listen(port);
                    return [2 /*return*/];
            }
        });
    });
}
exports.serve = serve;
