/**
 * 服务端待授权队列 + 限流 / 冷却 / 黑名单（与 Desktop 行为对齐）。
 * 黑名单与限流参数由 preload 从 dbStorage 读入后传入。
 */
"use strict";

const lanAuth = require("./lanAuth");
const lanDiscover = require("./lanDiscover");
const profile = require("../profile");

const PENDING_MAX = 16;
const pendingByHost = new Map();
const hitsByHost = new Map();
const cooldownUntil = new Map();

let cfg = {
    ratePerMin: 3,
    cooldownSec: 10,
    blacklist: new Set(),
};

function normalizeHost(host) {
    let h = String(host || "").trim();
    if (h.startsWith("[") && h.endsWith("]") && h.length > 2) {
        h = h.slice(1, -1);
    }
    if (h.toLowerCase().startsWith("::ffff:")) {
        h = h.slice(7);
    }
    return h.toLowerCase();
}

function setConfig(next) {
    const rate = Number(next && next.ratePerMin);
    const cool = Number(next && next.cooldownSec);
    const list = Array.isArray(next && next.blacklist) ? next.blacklist : [];
    cfg = {
        ratePerMin: Number.isFinite(rate) && rate >= 1 && rate <= 60 ? rate : 3,
        cooldownSec: Number.isFinite(cool) && cool >= 0 && cool <= 86400 ? cool : 10,
        blacklist: new Set(list.map(normalizeHost).filter(Boolean)),
    };
    for (const host of [...pendingByHost.keys()]) {
        if (cfg.blacklist.has(normalizeHost(host))) {
            const p = pendingByHost.get(host);
            pendingByHost.delete(host);
            if (p) {
                denySilent(p.req);
            }
        }
    }
}

function replyPacket(req, packet) {
    if (!req || !packet) {
        return;
    }
    if (req.tcp && typeof req.completeTcp === "function") {
        req.completeTcp(packet);
        return;
    }
    lanDiscover.sendAuthPacket(req.host, req.replyPort, packet);
}

function denySilent(req, waitSec) {
    if (!req) {
        return;
    }
    replyPacket(req, lanAuth.encodeDeny(req.nonce, waitSec));
}

function attachTcp(req) {
    let resolveReply;
    let rejectReply;
    req._tcpDone = false;
    req.tcp = true;
    req.earlyPending = null;
    req.tcpReply = new Promise((resolve, reject) => {
        resolveReply = resolve;
        rejectReply = reject;
    });
    req.completeTcp = (buf) => {
        if (req._tcpDone) {
            return;
        }
        req._tcpDone = true;
        resolveReply(buf);
    };
    req.failTcp = (err) => {
        if (req._tcpDone) {
            return;
        }
        req._tcpDone = true;
        rejectReply(err || new Error("cancelled"));
    };
}

function cooldownLeftSec(host, now) {
    const key = normalizeHost(host);
    const started = cooldownUntil.get(key) || 0;
    if (!started) {
        return 0;
    }
    const cool = cfg.cooldownSec;
    if (cool <= 0) {
        cooldownUntil.delete(key);
        return 0;
    }
    const until = started + cool * 1000;
    if (until <= now) {
        cooldownUntil.delete(key);
        return 0;
    }
    return Math.min(lanAuth.DENY_HARD - 1, Math.max(1, Math.ceil((until - now) / 1000)));
}

function noteHit(host, now) {
    const windowMs = 60_000;
    let hits = hitsByHost.get(host);
    if (!hits) {
        hits = [];
        hitsByHost.set(host, hits);
    }
    while (hits.length && now - hits[0] >= windowMs) {
        hits.shift();
    }
    if (hits.length >= cfg.ratePerMin) {
        applyCooldown(host);
        return false;
    }
    hits.push(now);
    return true;
}

function trimOverflow() {
    while (pendingByHost.size > PENDING_MAX) {
        let oldestHost = null;
        let oldestAt = Infinity;
        for (const [h, p] of pendingByHost) {
            if (p.at < oldestAt) {
                oldestAt = p.at;
                oldestHost = h;
            }
        }
        if (!oldestHost) {
            break;
        }
        const drop = pendingByHost.get(oldestHost);
        pendingByHost.delete(oldestHost);
        if (drop) {
            denySilent(drop.req);
        }
    }
}

function serverRunning() {
    const s = profile.currentServer;
    return !!(s && s.running);
}

function onRequest(req) {
    if (!req || !serverRunning()) {
        denySilent(req);
        return;
    }
    const host = normalizeHost(req.host);
    const prev = pendingByHost.get(host);
    if (prev && prev.req && req.nonce && prev.req.nonce.equals(req.nonce)) {
        if (req.tcp && typeof req.completeTcp === "function") {
            prev.req.tcp = true;
            prev.req.completeTcp = req.completeTcp;
            prev.req.failTcp = req.failTcp;
            prev.req.tcpReply = req.tcpReply;
            if (prev.serverPub) {
                req.earlyPending = lanAuth.encodePending(req.nonce, prev.serverPub);
            }
        }
        return;
    }
    if (!host || cfg.blacklist.has(host)) {
        denySilent(req);
        return;
    }
    const now = Date.now();
    const left = cooldownLeftSec(host, now);
    if (left > 0) {
        denySilent(req, left);
        return;
    }
    if (!noteHit(host, now)) {
        denySilent(req, cooldownLeftSec(host, Date.now()));
        return;
    }
    if (!req.clientPub || req.clientPub.length !== lanAuth.PUB_LEN) {
        denySilent(req, 0);
        return;
    }
    let serverKp;
    let serverPub;
    let sas;
    try {
        const Ecdh = require("./ecdh");
        serverKp = Ecdh.generate();
        serverPub = Ecdh.encodePublic(serverKp);
        sas = lanAuth.sasCode(req.clientPub, serverPub, req.nonce);
    } catch (_e) {
        denySilent(req, 0);
        return;
    }
    const older = pendingByHost.get(host);
    if (older && older.req && !older.req.nonce.equals(req.nonce)) {
        denySilent(older.req, 0);
    }
    pendingByHost.set(host, {
        req,
        at: now,
        name: req.name || "",
        serverKp,
        serverPub,
        sas: sas || "",
    });
    trimOverflow();
    const pendingPkt = lanAuth.encodePending(req.nonce, serverPub);
    if (req.tcp) {
        req.earlyPending = pendingPkt;
    } else {
        lanDiscover.sendAuthPacket(req.host, req.replyPort, pendingPkt);
    }
}

function listPending() {
    const now = Date.now();
    for (const [host, p] of [...pendingByHost.entries()]) {
        if (now - p.at > lanAuth.REQUEST_WAIT_MS) {
            pendingByHost.delete(host);
            denySilent(p.req);
        }
    }
    return [...pendingByHost.entries()].map(([host, p]) => ({
        host,
        name: p.name || p.req.name || "未知设备",
        at: p.at,
        replyPort: p.req.replyPort,
        sas: p.sas || "",
    })).sort((a, b) => a.at - b.at);
}

function applyCooldown(host) {
    const key = normalizeHost(host);
    if (cfg.cooldownSec <= 0 || !key) {
        return;
    }
    cooldownUntil.set(key, Date.now());
    // 记下拒绝时刻。剩余时间按当前设置算，改短立刻生效。
    hitsByHost.delete(key);
}

/**
 * @param {string} host
 * @param {"allow"|"deny"|"blacklist"} action
 */
function decide(host, action) {
    const key = normalizeHost(host);
    const pending = pendingByHost.get(key);
    pendingByHost.delete(key);
    if (action === "blacklist") {
        cfg.blacklist.add(key);
    }
    if (!pending) {
        return { ok: false, host: key, action, blacklist: [...cfg.blacklist] };
    }
    const req = pending.req;
    const name = pending.name || req.name || "未知设备";
    const s = profile.currentServer;
    if (action === "allow" && s && s.running && !cfg.blacklist.has(key)) {
        if (!req.clientPub || req.clientPub.length !== lanAuth.PUB_LEN || !pending.serverKp || !pending.serverPub) {
            denySilent(req, 0);
            return { ok: false, host: key, name, action: "deny", blacklist: [...cfg.blacklist] };
        }
        try {
            const psk = lanAuth.deriveGrantPsk(pending.serverKp, req.clientPub, req.nonce);
            cooldownUntil.delete(key);
            const exp = Date.now() + lanAuth.GRANT_TTL_MS;
            s.putLanGrant(req.host, psk, lanAuth.GRANT_TTL_MS, name);
            replyPacket(req, lanAuth.encodeGrant(req.nonce, pending.serverPub, s.port, exp));
            return {
                ok: true,
                host: key,
                name,
                action: "allow",
                sas: pending.sas || "",
                blacklist: [...cfg.blacklist],
            };
        } catch (_e) {
            denySilent(req, 0);
            return { ok: false, host: key, name, action: "deny", blacklist: [...cfg.blacklist] };
        }
    }
    if (s) {
        s.revokeLanGrant(req.host);
    }
    if (action === "blacklist" || cfg.blacklist.has(key)) {
        denySilent(req, lanAuth.DENY_HARD);
    } else {
        applyCooldown(key);
        denySilent(req, Math.min(lanAuth.DENY_HARD - 1, Math.max(0, cfg.cooldownSec)));
    }
    return {
        ok: true,
        host: key,
        name,
        action: action === "blacklist" ? "blacklist" : "deny",
        blacklist: [...cfg.blacklist],
    };
}

function denyAll() {
    const hosts = [...pendingByHost.keys()];
    const results = [];
    for (const h of hosts) {
        results.push(decide(h, "deny"));
    }
    return results;
}

function clearPending(deny) {
    if (deny) {
        for (const p of pendingByHost.values()) {
            denySilent(p.req);
        }
    }
    pendingByHost.clear();
}

function drop(host, nonce) {
    const key = normalizeHost(host);
    const pending = pendingByHost.get(key);
    if (!pending || !pending.req || !nonce || !pending.req.nonce.equals(nonce)) {
        return false;
    }
    pendingByHost.delete(key);
    if (typeof pending.req.failTcp === "function") {
        pending.req.failTcp();
    }
    return true;
}

/**
 * 开头是 TSA1 的 TCP 是授权，不占会话名额。
 * 先回 PENDING，允许/拒绝走同一条连接；对端关掉或发 CANCEL 就丢掉待授权。
 */
function acceptTcp(sock, first) {
    const host = normalizeHost(sock.remoteAddress);
    const replyPort = Number(sock.remotePort) || 0;
    let buf = Buffer.isBuffer(first) ? Buffer.from(first) : Buffer.alloc(0);
    let dead = false;
    sock.on("error", () => {
        dead = true;
    });
    sock.on("close", () => {
        dead = true;
    });
    const pull = (ms) => new Promise((resolve) => {
        if (dead) {
            resolve(null);
            return;
        }
        const onData = (chunk) => {
            cleanup();
            resolve(chunk);
        };
        const onClose = () => {
            cleanup();
            resolve(null);
        };
        const timer = setTimeout(() => {
            cleanup();
            resolve(Buffer.alloc(0));
        }, ms);
        function cleanup() {
            clearTimeout(timer);
            sock.off("data", onData);
            sock.off("close", onClose);
        }
        sock.on("data", onData);
        sock.on("close", onClose);
    });
    (async () => {
        let req = null;
        try {
            const headerEnd = Date.now() + 5000;
            let need = -1;
            while (Date.now() < headerEnd) {
                if (buf.length >= 7) {
                    if (buf[4] !== lanAuth.VERSION || buf[5] !== lanAuth.TYPE_REQUEST) {
                        return;
                    }
                    const nameLen = buf[6];
                    if (nameLen > lanAuth.NAME_MAX) {
                        return;
                    }
                    need = 7 + nameLen + lanAuth.NONCE_LEN + lanAuth.PUB_LEN;
                    if (buf.length >= need) {
                        break;
                    }
                }
                const more = await pull(400);
                if (more == null) {
                    return;
                }
                if (more.length) {
                    buf = Buffer.concat([buf, more]);
                }
            }
            if (need < 0 || buf.length < need) {
                return;
            }
            req = lanAuth.parseRequest(buf.subarray(0, need), host, replyPort);
            if (!req) {
                return;
            }
            let extra = buf.subarray(need);
            attachTcp(req);
            onRequest(req);
            if (req.earlyPending) {
                sock.write(req.earlyPending);
            }
            const packet = await new Promise((resolve) => {
                let settled = false;
                const finish = (value) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearTimeout(timer);
                    sock.off("data", onData);
                    sock.off("close", onClose);
                    sock.off("error", onErr);
                    resolve(value);
                };
                const onData = (chunk) => {
                    extra = Buffer.concat([extra, chunk]);
                    if (lanAuth.isCancel(extra)) {
                        drop(host, req.nonce);
                        finish(null);
                    }
                };
                const onClose = () => {
                    drop(host, req.nonce);
                    finish(null);
                };
                const onErr = () => {
                    drop(host, req.nonce);
                    finish(null);
                };
                sock.on("data", onData);
                sock.on("close", onClose);
                sock.on("error", onErr);
                const timer = setTimeout(() => finish(null), lanAuth.REQUEST_WAIT_MS);
                req.tcpReply.then((pkt) => finish(pkt)).catch(() => finish(null));
                if (lanAuth.isCancel(extra)) {
                    drop(host, req.nonce);
                    finish(null);
                }
            });
            if (packet && !dead) {
                sock.write(packet);
            }
        } catch (_e) {
        } finally {
            try {
                sock.end();
            } catch (_e) {
            }
        }
    })();
}

function boot() {
    lanDiscover.setAuthRequestHandler(onRequest);
    lanDiscover.setAuthCancelHandler(drop);
}

module.exports = {
    boot,
    acceptTcp,
    drop,
    setConfig,
    listPending,
    decide,
    denyAll,
    clearPending,
    normalizeHost,
};
