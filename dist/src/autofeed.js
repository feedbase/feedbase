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
exports.autofeed = exports.jqq = exports.filter = void 0;
var debug = require('debug')('feedbase:autofeed');
var fmt = require('./format');
var fetchurl = require('node-fetch');
var execSync = require('child_process').execSync;
var BN = require('bn.js');
var bn = function (n) { return new BN(n); };
var loaded = false;
function checkJQ() {
    if (!loaded) {
        try {
            var result = execSync('jq');
        }
        catch (e) {
            console.log('This feature requires the \'jq\' binary to be installed.');
            console.log(e);
            process.exit(1);
        }
        loaded = true;
    }
}
var opdb = {
    toWei: function (n) {
        // 10^18 == 10^4 * 10^14
        debug('WARN toWei sanitize');
        return (bn(n * 10000)).mul(bn(10).pow(bn(14)));
    },
    toBytes32: function (n) {
        debug('WARN toBytes32 sanitize');
        if (n instanceof BN) {
            return Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
        }
        throw new Error("Unrecognized arg type for toBytes32: " + n + " : " + typeof (n));
    },
    toNumber: function (n) {
        debug('WARN toNumber sanitize');
        return parseFloat(n);
    }
};
function filter(obj, jqs) {
    checkJQ();
    debug('jq filter', obj, jqs);
    try {
        var result = execSync("echo '" + JSON.stringify(obj) + "' | jq " + jqs);
        return result.toString();
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
}
exports.filter = filter;
function jqq(url, jqs, ops) {
    return __awaiter(this, void 0, void 0, function () {
        var res, json, value, _i, _a, op;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    checkJQ();
                    return [4 /*yield*/, fetchurl(url)];
                case 1:
                    res = _b.sent();
                    return [4 /*yield*/, res.json()];
                case 2:
                    json = _b.sent();
                    debug("url " + url);
                    debug("jqs " + jqs);
                    debug("ops " + ops);
                    debug('json', json);
                    value = filter(json, jqs);
                    debug("jq -> " + value);
                    if (!value || value == '') {
                        throw new Error("nothing matched jq filter: " + jqs + " " + JSON.stringify(json));
                    }
                    for (_i = 0, _a = ops.split(' '); _i < _a.length; _i++) {
                        op = _a[_i];
                        if (!opdb[op]) {
                            throw new Error("No such op: " + op);
                        }
                        value = opdb[op](value);
                        debug(op + " -> " + value);
                    }
                    debug("RESULT: " + value);
                    debug(value);
                    return [2 /*return*/, value];
            }
        });
    });
}
exports.jqq = jqq;
// autofeed({ url, jqs, ops })
function autofeed(args) {
    checkJQ();
    return function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        debug("auto getter " + args.url + " " + args.jqs + " " + args.ops);
                        return [4 /*yield*/, jqq(args.url, args.jqs, args.ops)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
}
exports.autofeed = autofeed;
