/**
 * 局域网临时授权（TSA1），与 Desktop 一致。
 * 客户端点设备发 REQUEST；服务端允许后单播 GRANT（32 字节一次性 PSK）。
 */
"use strict";

const crypto = require("crypto");
const net = require("net");
const C = require("./constants");
const B64 = require("./b64");

const MAGIC = Buffer.from("TSA1");
const VERSION = 1;
const TYPE_REQUEST = 1;
const TYPE_GRANT = 2;
const TYPE_DENY = 3;
const TYPE_PENDING = 4;
const NONCE_LEN = 16;
const NAME_MAX = 48;
const GRANT_TTL_MS = 60_000;
const REQUEST_WAIT_MS = 60_000;
const DENY_HARD = 0xffff;

const waiting = new Map();

function clipName(name) {
    const all = Buffer.from(String(name || ""), "utf8");
    if (all.length <= NAME_MAX) {
        return all;
    }
    let n = NAME_MAX;
    while (n > 0 && (all[n] & 0xc0) === 0x80) {
        n--;
    }
    return all.subarray(0, n);
}

function isAuthPacket(buf) {
    return Buffer.isBuffer(buf)
        && buf.length >= 6
        && buf[0] === 0x54 && buf[1] === 0x53 && buf[2] === 0x41 && buf[3] === 0x31
        && buf[4] === VERSION;
}

function typeOf(buf) {
    return isAuthPacket(buf) ? buf[5] : 0;
}

function parseRequest(buf, host, replyPort) {
    if (!isAuthPacket(buf) || buf[5] !== TYPE_REQUEST || buf.length < 7 + NONCE_LEN) {
        return null;
    }
    const nameLen = buf[6];
    if (nameLen > NAME_MAX || buf.length !== 7 + nameLen + NONCE_LEN) {
        return null;
    }
    return {
        host: String(host || ""),
        replyPort: Number(replyPort) || 0,
        name: buf.subarray(7, 7 + nameLen).toString("utf8"),
        nonce: Buffer.from(buf.subarray(7 + nameLen, 7 + nameLen + NONCE_LEN)),
    };
}

function encodeRequest(name, nonce) {
    const nameBytes = clipName(name);
    const out = Buffer.alloc(7 + nameBytes.length + NONCE_LEN);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_REQUEST;
    out[6] = nameBytes.length;
    nameBytes.copy(out, 7);
    Buffer.from(nonce).copy(out, 7 + nameBytes.length, 0, NONCE_LEN);
    return out;
}

function encodeGrant(nonce, psk, tcpPort, expireAtMs) {
    const out = Buffer.alloc(6 + NONCE_LEN + C.PSK_LEN + 2 + 4);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_GRANT;
    Buffer.from(nonce).copy(out, 6, 0, NONCE_LEN);
    Buffer.from(psk).copy(out, 6 + NONCE_LEN, 0, C.PSK_LEN);
    let o = 6 + NONCE_LEN + C.PSK_LEN;
    out.writeUInt16BE(tcpPort & 0xffff, o);
    const expSec = Math.min(0x7fffffff, Math.floor(Number(expireAtMs) / 1000));
    out.writeInt32BE(expSec, o + 2);
    return out;
}

function encodeDeny(nonce, waitSec) {
    const sec = waitSec == null || waitSec < 0 ? DENY_HARD : Math.min(DENY_HARD, waitSec | 0);
    const out = Buffer.alloc(6 + NONCE_LEN + 2);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_DENY;
    Buffer.from(nonce).copy(out, 6, 0, NONCE_LEN);
    out.writeUInt16BE(sec, 6 + NONCE_LEN);
    return out;
}

function denyWaitSec(buf) {
    const base = 6 + NONCE_LEN;
    if (!buf || buf.length < base + 2) {
        return -1;
    }
    return buf.readUInt16BE(base);
}

function denyMessage(waitSec) {
    if (waitSec < 0) {
        return "对方拒绝了这次授权。冷却结束后可以再请求，没有拉黑";
    }
    if (waitSec === DENY_HARD) {
        return "对方拒绝了授权";
    }
    if (waitSec === 0) {
        return "对方拒绝了这次授权，可以再请求";
    }
    return "对方暂时拒绝，约 " + waitSec + " 秒后可以再请求（没有拉黑）";
}

function deniedError(waitSec) {
    const err = new Error(denyMessage(waitSec));
    err.authDenied = true;
    return err;
}

function isDenied(e) {
    if (!e) {
        return false;
    }
    if (e.authDenied) {
        return true;
    }
    const m = String(e.message || "");
    return m.includes("拒绝") || m.includes("冷却");
}

function encodePending(nonce) {
    const out = Buffer.alloc(6 + NONCE_LEN);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_PENDING;
    Buffer.from(nonce).copy(out, 6, 0, NONCE_LEN);
    return out;
}

function onAuthReply(buf) {
    if (!isAuthPacket(buf) || buf.length < 6 + NONCE_LEN) {
        return;
    }
    const type = buf[5];
    const nonce = Buffer.from(buf.subarray(6, 6 + NONCE_LEN));
    const key = nonce.toString("hex");
    const entry = waiting.get(key);
    if (!entry) {
        return;
    }
    if (type === TYPE_DENY) {
        waiting.delete(key);
        entry.reject(deniedError(denyWaitSec(buf)));
        return;
    }
    if (type === TYPE_PENDING) {
        return;
    }
    if (type !== TYPE_GRANT) {
        return;
    }
    const need = 6 + NONCE_LEN + C.PSK_LEN + 2 + 4;
    if (buf.length < need) {
        return;
    }
    const psk = Buffer.from(buf.subarray(6 + NONCE_LEN, 6 + NONCE_LEN + C.PSK_LEN));
    const tcpPort = buf.readUInt16BE(6 + NONCE_LEN + C.PSK_LEN);
    waiting.delete(key);
    entry.resolve({ psk, tcpPort, pskB64: B64.enc(psk) });
}

/**
 * @param {import('dgram').Socket} sock
 * @returns {Promise<{psk: Buffer, tcpPort: number, pskB64: string}>}
 */
function requestAuth(sock, host, udpPort, deviceName) {
    return new Promise((resolve, reject) => {
        const nonce = crypto.randomBytes(NONCE_LEN);
        const key = nonce.toString("hex");
        const timer = setTimeout(() => {
            waiting.delete(key);
            reject(new Error("授权超时"));
        }, REQUEST_WAIT_MS);
        waiting.set(key, {
            resolve: (v) => {
                clearTimeout(timer);
                resolve(v);
            },
            reject: (e) => {
                clearTimeout(timer);
                reject(e);
            },
        });
        try {
            const packet = encodeRequest(deviceName, nonce);
            sock.send(packet, Number(udpPort), String(host));
        } catch (e) {
            waiting.delete(key);
            clearTimeout(timer);
            reject(e);
        }
    });
}

function requestAuthTcp(host, tcpPort, deviceName) {
    return new Promise((resolve, reject) => {
        const nonce = crypto.randomBytes(NONCE_LEN);
        const packet = encodeRequest(deviceName, nonce);
        const sock = net.connect({ host: String(host), port: Number(tcpPort) });
        let buf = Buffer.alloc(0);
        let settled = false;
        const timer = setTimeout(() => finish(new Error("等待服务端允许超时")), REQUEST_WAIT_MS);
        function finish(err, value) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            sock.destroy();
            if (err) {
                reject(err);
            } else {
                resolve(value);
            }
        }
        sock.setTimeout(5000, () => finish(new Error("等待服务端允许超时")));
        sock.on("error", (e) => finish(e));
        sock.on("connect", () => {
            sock.setTimeout(REQUEST_WAIT_MS);
            sock.write(packet);
        });
        sock.on("data", (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            if (buf.length < 6) {
                return;
            }
            if (!isAuthPacket(buf)) {
                finish(new Error("服务端没有按授权回应"));
                return;
            }
            const type = buf[5];
            if (type === TYPE_DENY) {
                if (buf.length < 6 + NONCE_LEN) {
                    return;
                }
                if (buf.length < 6 + NONCE_LEN + 2) {
                    if (!sock._denyWait) {
                        sock._denyWait = setTimeout(() => finish(deniedError(denyWaitSec(buf))), 150);
                    }
                    return;
                }
                clearTimeout(sock._denyWait);
                finish(deniedError(denyWaitSec(buf)));
                return;
            }
            if (type !== TYPE_GRANT) {
                finish(new Error("服务端没有按授权回应"));
                return;
            }
            const need = 6 + NONCE_LEN + C.PSK_LEN + 2 + 4;
            if (buf.length < need) {
                return;
            }
            const psk = Buffer.from(buf.subarray(6 + NONCE_LEN, 6 + NONCE_LEN + C.PSK_LEN));
            const port = buf.readUInt16BE(6 + NONCE_LEN + C.PSK_LEN);
            finish(null, { psk, tcpPort: port, pskB64: B64.enc(psk) });
        });
    });
}

function newPsk() {
    return crypto.randomBytes(C.PSK_LEN);
}

module.exports = {
    MAGIC,
    VERSION,
    TYPE_REQUEST,
    TYPE_GRANT,
    TYPE_DENY,
    TYPE_PENDING,
    NONCE_LEN,
    NAME_MAX,
    GRANT_TTL_MS,
    REQUEST_WAIT_MS,
    DENY_HARD,
    isAuthPacket,
    denyMessage,
    isDenied,
    typeOf,
    parseRequest,
    encodeRequest,
    encodeGrant,
    encodeDeny,
    encodePending,
    onAuthReply,
    requestAuth,
    requestAuthTcp,
    newPsk,
    B64,
};
