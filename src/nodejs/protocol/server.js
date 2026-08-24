"use strict";

const net = require("net");
const C = require("./constants");
const Pairing = require("./pairing");
const { TsPeer } = require("./peer");
const { AuthLimiter } = require("./authLimiter");

class TsServer {
    constructor(port, maxConnections, onText, onFileIo) {
        this.port = port;
        this.maxConnections = maxConnections || 1;
        this.onText = onText;
        this.onFileIo = onFileIo || null;
        this.material = Pairing.generate();
        this.peers = [];
        this.limiter = new AuthLimiter();
        this.server = null;
        this.running = false;
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
        const ip = sock.remoteAddress || "?";
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
