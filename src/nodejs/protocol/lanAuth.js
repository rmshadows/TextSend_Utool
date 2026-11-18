/**
 * 局域网临时授权（TSA1），与 Desktop 一致。
 * GRANT 里是临时公钥。一次性密钥由 ECDH 在两边各自算出，不进网络包。
 */
"use strict";

const crypto = require("crypto");
const net = require("net");
const C = require("./constants");
const B64 = require("./b64");
const Ecdh = require("./ecdh");
const Hkdf = require("./hkdf");

const MAGIC = Buffer.from("TSA1");
const VERSION = 2;
const PUB_LEN = 65;
const HKDF_INFO = "textsend-v1|lan-auth";
const TYPE_REQUEST = 1;
const TYPE_GRANT = 2;
const TYPE_DENY = 3;
const TYPE_PENDING = 4;
const TYPE_CANCEL = 5;
const NONCE_LEN = 16;
const NAME_MAX = 48;
const GRANT_TTL_MS = 60_000;
const REQUEST_WAIT_MS = 60_000;
const DENY_HARD = 0xffff;

const waiting = new Map();
let active = null;

function encodeCancel(nonce) {
    const out = Buffer.alloc(6 + NONCE_LEN);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_CANCEL;
    if (nonce && nonce.length >= NONCE_LEN) {
        nonce.copy(out, 6, 0, NONCE_LEN);
    }
    return out;
}

function isCancel(buf) {
    return isAuthPacket(buf) && buf.length >= 6 + NONCE_LEN && buf[5] === TYPE_CANCEL;
}

function cancelNonce(buf) {
    if (!isCancel(buf)) {
        return null;
    }
    return Buffer.from(buf.subarray(6, 6 + NONCE_LEN));
}

function isCancelled(e) {
    let cur = e;
    while (cur) {
        if (cur.code === "cancelled") {
            return true;
        }
        cur = cur.cause;
    }
    return false;
}

function cancelledError() {
    const e = new Error("已取消授权申请");
    e.code = "cancelled";
    return e;
}

function isWaiting(host) {
    if (!active || active.cancelled) {
        return false;
    }
    return normHost(active.host) === normHost(host);
}

function cancelActive() {
    const a = active;
    if (!a || a.cancelled) {
        return false;
    }
    a.cancelled = true;
    const pkt = a.nonce ? encodeCancel(a.nonce) : null;
    if (pkt && a.tcp && !a.tcp.destroyed) {
        try {
            a.tcp.write(pkt);
        } catch (_e) {
        }
    }
    if (pkt && a.udp && a.host && a.udpPort > 0) {
        try {
            a.udp.send(pkt, a.udpPort, String(a.host));
        } catch (_e) {
        }
    }
    if (a.nonce) {
        const entry = waiting.get(a.nonce.toString("hex"));
        if (entry && entry.reject) {
            entry.reject(cancelledError());
        }
    }
    if (a.tcp) {
        try {
            a.tcp.destroy();
        } catch (_e) {
        }
    }
    return true;
}

function normHost(host) {
    let h = String(host || "").trim().toLowerCase();
    if (h.startsWith("::ffff:") && h.length > 7) {
        h = h.slice(7);
    }
    return h;
}

function beginActive(host, udpPort, nonce) {
    const mine = { host, udpPort, nonce, tcp: null, udp: null, cancelled: false };
    active = mine;
    return mine;
}

function endActive(mine) {
    if (active === mine) {
        active = null;
    }
}

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
    const base = 7 + nameLen + NONCE_LEN;
    if (nameLen > NAME_MAX || buf.length !== base + PUB_LEN || buf[base] !== 0x04) {
        return null;
    }
    return {
        host: String(host || ""),
        replyPort: Number(replyPort) || 0,
        name: buf.subarray(7, 7 + nameLen).toString("utf8"),
        nonce: Buffer.from(buf.subarray(7 + nameLen, base)),
        clientPub: Buffer.from(buf.subarray(base, base + PUB_LEN)),
    };
}

function encodeRequest(name, nonce, clientPub) {
    const nameBytes = clipName(name);
    const out = Buffer.alloc(7 + nameBytes.length + NONCE_LEN + PUB_LEN);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_REQUEST;
    out[6] = nameBytes.length;
    nameBytes.copy(out, 7);
    Buffer.from(nonce).copy(out, 7 + nameBytes.length, 0, NONCE_LEN);
    Buffer.from(clientPub).copy(out, 7 + nameBytes.length + NONCE_LEN, 0, PUB_LEN);
    return out;
}

function encodeGrant(nonce, serverPub, tcpPort, expireAtMs) {
    const out = Buffer.alloc(6 + NONCE_LEN + PUB_LEN + 2 + 4);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_GRANT;
    Buffer.from(nonce).copy(out, 6, 0, NONCE_LEN);
    Buffer.from(serverPub).copy(out, 6 + NONCE_LEN, 0, PUB_LEN);
    let o = 6 + NONCE_LEN + PUB_LEN;
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

function encodePending(nonce, serverPub) {
    const pub = Buffer.from(serverPub);
    if (pub.length !== PUB_LEN) {
        throw new Error("PENDING 需要服务端公钥");
    }
    const out = Buffer.alloc(6 + NONCE_LEN + PUB_LEN);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out[5] = TYPE_PENDING;
    Buffer.from(nonce).copy(out, 6, 0, NONCE_LEN);
    pub.copy(out, 6 + NONCE_LEN, 0, PUB_LEN);
    return out;
}

function pendingServerPub(buf) {
    const need = 6 + NONCE_LEN + PUB_LEN;
    if (!buf || buf.length < need || buf[5] !== TYPE_PENDING) {
        return null;
    }
    const pub = Buffer.from(buf.subarray(6 + NONCE_LEN, need));
    return pub[0] === 0x04 ? pub : null;
}

/** 短核对码：SHA-256(clientPub‖serverPub‖nonce) 前 4 字节 → ABCD-EF01。 */
function sasCode(clientPub, serverPub, nonce) {
    try {
        const c = Buffer.from(clientPub || []);
        const s = Buffer.from(serverPub || []);
        const n = Buffer.from(nonce || []);
        if (c.length !== PUB_LEN || s.length !== PUB_LEN || n.length !== NONCE_LEN) {
            return "";
        }
        const dig = crypto.createHash("sha256").update(c).update(s).update(n).digest();
        const hex = dig.subarray(0, 4).toString("hex").toUpperCase();
        return hex.slice(0, 4) + "-" + hex.slice(4);
    } catch (_e) {
        return "";
    }
}

function notePending(entry, buf, nonce) {
    const serverPub = pendingServerPub(buf);
    if (!serverPub) {
        return;
    }
    entry.pendingServerPub = serverPub;
    const clientPub = entry.clientPub;
    const sas = sasCode(clientPub, serverPub, nonce);
    if (sas && typeof entry.onSas === "function") {
        try {
            entry.onSas(sas);
        } catch (_e) {
        }
    }
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
        notePending(entry, buf, nonce);
        return;
    }
    if (type !== TYPE_GRANT) {
        return;
    }
    try {
        const grant = grantFromPacket(buf, entry, nonce);
        waiting.delete(key);
        entry.resolve(grant);
    } catch (e) {
        waiting.delete(key);
        entry.reject(e);
    }
}

function deriveGrantPsk(local, remotePub, nonce) {
    const pub = Buffer.from(remotePub);
    if (pub.length !== PUB_LEN || pub[0] !== 0x04) {
        throw new Error("授权公钥无效");
    }
    const secret = Ecdh.sharedSecret(local, pub);
    return Hkdf.derive(secret, Buffer.from(nonce), HKDF_INFO, C.PSK_LEN);
}

function grantFromPacket(buf, entry, expectNonce) {
    const need = 6 + NONCE_LEN + PUB_LEN + 2 + 4;
    if (!buf || buf.length < need) {
        throw new Error("授权回应太短");
    }
    const nonce = Buffer.from(buf.subarray(6, 6 + NONCE_LEN));
    if (!nonce.equals(Buffer.from(expectNonce))) {
        throw new Error("授权回应和这次请求对不上");
    }
    const serverPub = Buffer.from(buf.subarray(6 + NONCE_LEN, 6 + NONCE_LEN + PUB_LEN));
    if (serverPub[0] !== 0x04) {
        throw new Error("授权公钥无效");
    }
    if (entry.pendingServerPub && !entry.pendingServerPub.equals(serverPub)) {
        throw new Error("核对码对应的公钥变了，已中止");
    }
    const tcpPort = buf.readUInt16BE(6 + NONCE_LEN + PUB_LEN);
    const psk = deriveGrantPsk(entry.ecdh, serverPub, nonce);
    return { psk, tcpPort, pskB64: B64.enc(psk) };
}

/**
 * @param {import('dgram').Socket} sock
 * @returns {Promise<{psk: Buffer, tcpPort: number, pskB64: string}>}
 */
function requestAuth(sock, host, udpPort, deviceName, onSas) {
    return new Promise((resolve, reject) => {
        const nonce = crypto.randomBytes(NONCE_LEN);
        const ecdh = Ecdh.generate();
        const clientPub = Ecdh.encodePublic(ecdh);
        const key = nonce.toString("hex");
        const mine = beginActive(host, Number(udpPort), nonce);
        mine.udp = sock;
        const timer = setTimeout(() => {
            waiting.delete(key);
            endActive(mine);
            reject(mine.cancelled ? cancelledError() : new Error("授权超时"));
        }, REQUEST_WAIT_MS);
        waiting.set(key, {
            ecdh,
            clientPub,
            onSas,
            resolve: (v) => {
                clearTimeout(timer);
                endActive(mine);
                resolve(v);
            },
            reject: (e) => {
                clearTimeout(timer);
                endActive(mine);
                reject(mine.cancelled ? cancelledError() : e);
            },
        });
        try {
            const packet = encodeRequest(deviceName, nonce, clientPub);
            sock.send(packet, Number(udpPort), String(host));
        } catch (e) {
            waiting.delete(key);
            clearTimeout(timer);
            endActive(mine);
            reject(mine.cancelled ? cancelledError() : e);
        }
    });
}

function requestAuthTcp(host, tcpPort, deviceName, onSas) {
    return new Promise((resolve, reject) => {
        const nonce = crypto.randomBytes(NONCE_LEN);
        const ecdh = Ecdh.generate();
        const clientPub = Ecdh.encodePublic(ecdh);
        const packet = encodeRequest(deviceName, nonce, clientPub);
        const entry = { ecdh, clientPub, onSas, pendingServerPub: null };
        const mine = beginActive(host, 0, nonce);
        const sock = net.connect({ host: String(host), port: Number(tcpPort) });
        mine.tcp = sock;
        let buf = Buffer.alloc(0);
        let settled = false;
        const timer = setTimeout(() => finish(new Error("等待服务端允许超时")), REQUEST_WAIT_MS);
        function finish(err, value) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            waiting.delete(nonce.toString("hex"));
            endActive(mine);
            sock.destroy();
            if (mine.cancelled) {
                reject(cancelledError());
            } else if (err) {
                reject(err);
            } else {
                resolve(value);
            }
        }
        const key = nonce.toString("hex");
        waiting.set(key, {
            ecdh,
            clientPub,
            onSas,
            reject: (e) => finish(e),
            resolve: (v) => finish(null, v),
        });
        sock.setTimeout(5000, () => finish(new Error("等待服务端允许超时")));
        sock.on("error", (e) => finish(e));
        sock.on("close", () => finish(new Error("授权连接已断开")));
        sock.on("connect", () => {
            sock.setTimeout(REQUEST_WAIT_MS);
            sock.write(packet);
        });
        sock.on("data", (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            while (buf.length >= 6) {
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
                if (type === TYPE_PENDING) {
                    const need = 6 + NONCE_LEN + PUB_LEN;
                    if (buf.length < need) {
                        return;
                    }
                    notePending(entry, buf.subarray(0, need), nonce);
                    buf = buf.subarray(need);
                    continue;
                }
                if (type !== TYPE_GRANT) {
                    finish(new Error("服务端没有按授权回应"));
                    return;
                }
                const need = 6 + NONCE_LEN + PUB_LEN + 2 + 4;
                if (buf.length < need) {
                    return;
                }
                try {
                    finish(null, grantFromPacket(buf.subarray(0, need), entry, nonce));
                } catch (e) {
                    finish(e);
                }
                return;
            }
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
    TYPE_CANCEL,
    NONCE_LEN,
    PUB_LEN,
    NAME_MAX,
    GRANT_TTL_MS,
    REQUEST_WAIT_MS,
    DENY_HARD,
    isAuthPacket,
    denyMessage,
    isDenied,
    isCancelled,
    isWaiting,
    cancelActive,
    encodeCancel,
    isCancel,
    cancelNonce,
    typeOf,
    parseRequest,
    encodeRequest,
    encodeGrant,
    deriveGrantPsk,
    encodeDeny,
    encodePending,
    pendingServerPub,
    sasCode,
    onAuthReply,
    requestAuth,
    requestAuthTcp,
    newPsk,
    B64,
};
