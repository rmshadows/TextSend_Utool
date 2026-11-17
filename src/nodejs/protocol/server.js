"use strict";

const net = require("net");
const os = require("os");
const C = require("./constants");
const Pairing = require("./pairing");
const { TsPeer } = require("./peer");
const { AuthLimiter } = require("./authLimiter");

function normalizeHost(addr) {
    let h = String(addr || "").trim();
    if (h.startsWith("[") && h.endsWith("]") && h.length > 2) {
        h = h.slice(1, -1);
    }
    if (h.toLowerCase().startsWith("::ffff:")) {
        h = h.slice(7);
    }
    return h.toLowerCase();
}

function isSelfHost(addr) {
    const h = normalizeHost(addr);
    if (!h) {
        return false;
    }
    if (h === "127.0.0.1" || h === "::1" || h === "localhost") {
        return true;
    }
    const ifs = os.networkInterfaces();
    for (const list of Object.values(ifs)) {
        for (const inf of list || []) {
            if (normalizeHost(inf.address) === h) {
                return true;
            }
        }
    }
    return false;
}

function localDeviceName() {
    const raw = String(os.hostname() || "").replace(/[\u0000-\u001f]/g, "").trim();
    return raw || "PC";
}

class TsServer {
    constructor(port, maxConnections, onText, onFileIo, pinOpts) {
        this.port = port;
        this.maxConnections = maxConnections || 1;
        this.onText = onText;
        this.onFileIo = onFileIo || null;
        const opts = pinOpts || {};
        this.material = Pairing.forSession(!!opts.customEnabled, opts.customPin || "");
        this.peers = [];
        this.limiter = new AuthLimiter();
        this.server = null;
        this.running = false;
        /** @type {Map<string, {psk: Buffer, expireAt: number}>} */
        this.lanGrants = new Map();
        /** @type {Map<string, string>} */
        this.clientNames = new Map();
    }

    listen() {
        const self = this;
        return new Promise((resolve, reject) => {
            const server = net.createServer({ pauseOnConnect: false });
            self.server = server;
            server.maxConnections = 512;
            server.on("connection", (sock) => self._onConnection(sock));
            server.on("error", (e) => {
                console.log("Log: server error " + e);
                self.running = false;
                reject(e);
            });
            server.listen(self.port, () => {
                self.running = true;
                const addr = server.address();
                if (addr && addr.port) {
                    self.port = addr.port;
                }
                console.log("Log: v1 server listen " + self.port);
                resolve();
            });
        });
    }

    _onConnection(sock) {
        const ip = normalizeHost(sock.remoteAddress || "?");
        console.log("Log: 【接入】TCP " + ip + ":" + sock.remotePort);
        if (!this.limiter.allow(ip)) {
            console.log("Log: 【拒绝】" + ip + " PIN 失败次数过多，已锁定");
            sock.destroy();
            return;
        }
        this.peers = this.peers.filter((p) => p.isAlive());
        if (this.peers.length >= this.maxConnections) {
            console.log("Log: 【拒绝】" + ip + " 已达最大连接 " + this.maxConnections);
            sock.destroy();
            return;
        }
        const box = { peer: null };
        const peer = new TsPeer(sock, {
            asServer: true,
            material: this.material,
            server: this,
            onText: this.onText,
            onFileIo: this.onFileIo,
            onReady: () => {
                this.limiter.ok(ip);
            },
            onClosed: () => {
                const self = box.peer;
                if (self && !self.handshakeSucceeded() && this.running) {
                    this.limiter.fail(ip);
                }
                this.peers = this.peers.filter((p) => p.isAlive());
            },
        });
        box.peer = peer;
        this.peers.push(peer);
        peer.start();
    }

    putLanGrant(host, psk, ttlMs, deviceName) {
        const h = normalizeHost(host);
        if (!h || !Buffer.isBuffer(psk)) {
            return;
        }
        this.lanGrants.set(h, {
            psk: Buffer.from(psk),
            expireAt: Date.now() + (Number(ttlMs) > 0 ? Number(ttlMs) : 60_000),
        });
        const name = String(deviceName || "").trim();
        if (name) {
            this.clientNames.set(h, name);
        }
    }

    revokeLanGrant(host) {
        this.lanGrants.delete(normalizeHost(host));
    }

    peekGrant(host) {
        this._purgeGrants();
        const g = this.lanGrants.get(normalizeHost(host));
        return g ? g.psk : null;
    }

    consumeGrant(host, psk) {
        const h = normalizeHost(host);
        const g = this.lanGrants.get(h);
        if (!g || !psk || !g.psk.equals(psk)) {
            return;
        }
        this.lanGrants.delete(h);
    }

    _purgeGrants() {
        const now = Date.now();
        for (const [h, g] of this.lanGrants) {
            if (!g || g.expireAt <= now) {
                this.lanGrants.delete(h);
            }
        }
    }

    listAliveClients() {
        return this.peers.filter((p) => p.isAlive()).map((p) => {
            const sock = p.socket;
            const host = normalizeHost(sock && sock.remoteAddress);
            let name = this.clientNames.get(host) || "";
            // 扫码/PIN 本机连本机没有授权名时，用本机主机名回填
            if (!name && isSelfHost(host)) {
                name = localDeviceName();
            }
            return {
                host,
                port: sock && sock.remotePort || 0,
                name,
                label: name ? (name + "  ·  " + host) : host,
            };
        }).filter((c) => c.host);
    }

    kickHost(host) {
        const h = normalizeHost(host);
        if (!h) {
            return false;
        }
        let hit = false;
        for (const p of [...this.peers]) {
            const rh = normalizeHost(p.socket && p.socket.remoteAddress);
            if (rh === h) {
                p.close();
                hit = true;
            }
        }
        this.peers = this.peers.filter((p) => p.isAlive());
        this.clientNames.delete(h);
        this.revokeLanGrant(h);
        return hit;
    }

    readyCount() {
        return this.peers.filter((p) => p.isAlive()).length;
    }

    async sendToAll(text) {
        const snap = this.peers.filter((p) => p.isAlive());
        let sent = 0;
        for (const p of snap) {
            try {
                await p.sendText(text);
                sent++;
            } catch (e) {
                console.log("Log: sendToAll " + e);
            }
        }
        return sent;
    }

    stop() {
        this.running = false;
        this.lanGrants.clear();
        this.clientNames.clear();
        for (const p of this.peers) {
            p.close();
        }
        this.peers = [];
        if (this.server) {
            try {
                this.server.close();
            } catch (e) {
                /* ignore */
            }
            this.server = null;
        }
    }
}

module.exports = { TsServer, ACK_TIMEOUT_MS: C.ACK_TIMEOUT_MS };
