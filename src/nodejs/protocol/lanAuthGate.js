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
    cooldownSec: 120,
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
        cooldownSec: Number.isFinite(cool) && cool >= 0 && cool <= 86400 ? cool : 120,
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

function denySilent(req) {
    if (!req) {
        return;
    }
    lanDiscover.sendAuthPacket(req.host, req.replyPort, lanAuth.encodeDeny(req.nonce));
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
        if (cfg.cooldownSec > 0) {
            cooldownUntil.set(host, now + cfg.cooldownSec * 1000);
        }
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
    if (!host || cfg.blacklist.has(host)) {
        denySilent(req);
        return;
    }
    const now = Date.now();
    const until = cooldownUntil.get(host) || 0;
    if (until > now) {
        denySilent(req);
        return;
    }
    if (!noteHit(host, now)) {
        denySilent(req);
        return;
    }
    const prev = pendingByHost.get(host);
    if (prev && prev.req && !prev.req.nonce.equals(req.nonce)) {
        denySilent(prev.req);
    }
    pendingByHost.set(host, { req, at: now, name: req.name || "" });
    trimOverflow();
    lanDiscover.sendAuthPacket(req.host, req.replyPort, lanAuth.encodePending(req.nonce));
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
    })).sort((a, b) => a.at - b.at);
}

function applyCooldown(host) {
    if (cfg.cooldownSec <= 0) {
        return;
    }
    cooldownUntil.set(normalizeHost(host), Date.now() + cfg.cooldownSec * 1000);
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
        cooldownUntil.delete(key);
        const psk = lanAuth.newPsk();
        const exp = Date.now() + lanAuth.GRANT_TTL_MS;
        s.putLanGrant(req.host, psk, lanAuth.GRANT_TTL_MS, name);
        lanDiscover.sendAuthPacket(req.host, req.replyPort,
            lanAuth.encodeGrant(req.nonce, psk, s.port, exp));
        return { ok: true, host: key, name, action: "allow", blacklist: [...cfg.blacklist] };
    }
    if (s) {
        s.revokeLanGrant(req.host);
    }
    denySilent(req);
    applyCooldown(key);
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

function boot() {
    lanDiscover.setAuthRequestHandler(onRequest);
}

module.exports = {
    boot,
    setConfig,
    listPending,
    decide,
    denyAll,
    clearPending,
    normalizeHost,
};
