"use strict";

const crypto = require("crypto");
const C = require("./constants");
const B64 = require("./b64");
const AesGcm = require("./aesGcm");
const Hkdf = require("./hkdf");
const Ecdh = require("./ecdh");
const TsUri = require("./tsUri");
const { writeFrame, FrameReader } = require("./frame");

class TsPeer {
    constructor(socket, opts) {
        this.socket = socket;
        this.asServer = !!opts.asServer;
        this.material = opts.material || null;
        this.uri = opts.uri || null;
        this.onReady = opts.onReady || null;
        this.onClosed = opts.onClosed || null;
        this.onText = opts.onText || null;
        this.reader = new FrameReader();
        this.waiters = [];
        this.phase = "handshake";
        this.alive = true;
        this.handshakeOk = false;
        this.aesKey = null;
        this.sessionId = "";
        this.waitingAck = null;
        this._handshakeTimer = null;

        socket.setNoDelay(true);
        socket.on("data", (chunk) => {
            try {
                this.reader.push(chunk);
                this.drain();
            } catch (e) {
                this._fail(e);
            }
        });
        socket.on("close", () => this.close());
        socket.on("error", () => this.close());
    }

    isAlive() {
        return this.alive && this.aesKey != null && this.handshakeOk;
    }

    handshakeSucceeded() {
        return this.handshakeOk;
    }

    async start() {
        this.socket.setTimeout(C.HANDSHAKE_TIMEOUT_MS);
        this._handshakeTimer = setTimeout(() => {
            this._fail(new Error("handshake timeout"));
        }, C.HANDSHAKE_TIMEOUT_MS);
        try {
            if (this.asServer) {
                await this._handshakeServer();
            } else {
                await this._handshakeClient();
            }
            this.handshakeOk = true;
            this.socket.setTimeout(0);
            this.phase = "session";
            this.drain();
            this._log("session ready: " + this.sessionId);
            if (this.onReady) {
                this.onReady();
            }
        } catch (e) {
            this._log("【握手】失败: " + (e && e.message ? e.message : e));
            this.close();
        } finally {
            if (this._handshakeTimer) {
                clearTimeout(this._handshakeTimer);
                this._handshakeTimer = null;
            }
        }
    }

    drain() {
        if (this.phase === "handshake") {
            while (this.waiters.length) {
                let f;
                try {
                    f = this.reader.next();
                } catch (e) {
                    const w = this.waiters.shift();
                    w.reject(e);
                    return;
                }
                if (!f) {
                    return;
                }
                this.waiters.shift().resolve(f);
            }
            return;
        }
        let f = this.reader.next();
        while (f) {
            this._handleSession(f);
            f = this.reader.next();
        }
    }

    readExpect(type) {
        return new Promise((resolve, reject) => {
            const tryOne = (f) => {
                if (f.type !== type) {
                    reject(new Error("expect type " + type + " got " + f.type));
                } else {
                    resolve(f);
                }
            };
            this.waiters.push({ resolve: tryOne, reject });
            try {
                this.drain();
            } catch (e) {
                reject(e);
            }
        });
    }

    async _handshakeServer() {
        const hello = {
            ver: 1,
            role: "server",
            caps: ["text"],
            auth: "psk+pin",
            pinLen: C.PIN_LEN,
        };
        this._writePlain(C.TYPE_HELLO, hello);
        this._log("【握手】发送 HELLO  ver=1 auth=psk+pin");

        const clientHello = await this.readExpect(C.TYPE_HELLO);
        JSON.parse(clientHello.payload.toString("utf8"));

        const kxIn = await this.readExpect(C.TYPE_KEY_EXCHANGE);
        const clientKx = JSON.parse(kxIn.payload.toString("utf8"));
        const mode = clientKx.mode;
        this._log("【握手】收到 KEY_EXCHANGE  mode=" + mode);

        const serverNonce = crypto.randomBytes(C.NONCE_LEN);
        const serverKx = { mode };

        if (mode === "pin") {
            const kp = Ecdh.generate();
            serverKx.curve = C.CURVE;
            serverKx.pub = B64.enc(Ecdh.encodePublic(kp));
            serverKx.nonce = B64.enc(serverNonce);
            this._writePlain(C.TYPE_KEY_EXCHANGE, serverKx);
            const clientNonce = B64.dec(clientKx.nonce);
            const clientPub = B64.dec(clientKx.pub);
            const shared = Ecdh.sharedSecret(kp, clientPub);
            const salt = Buffer.concat([serverNonce, clientNonce]);
            const info = C.HKDF_INFO_PIN_PREFIX + this.material.pin;
            this.aesKey = Hkdf.derive(shared, salt, info, C.PSK_LEN);
        } else if (mode === "psk") {
            serverKx.nonce = B64.enc(serverNonce);
            this._writePlain(C.TYPE_KEY_EXCHANGE, serverKx);
            const clientNonce = B64.dec(clientKx.nonce);
            const salt = Buffer.concat([serverNonce, clientNonce]);
            this.aesKey = Hkdf.derive(this.material.psk, salt, C.HKDF_INFO_PSK, C.PSK_LEN);
        } else {
            throw new Error("unsupported mode: " + mode);
        }

        const auth = await this.readExpect(C.TYPE_AUTH_OK);
        const clientAuth = JSON.parse(AesGcm.open(this.aesKey, auth.payload).toString("utf8"));
        if (clientAuth.role !== "client") {
            throw new Error("bad AUTH_OK role");
        }

        this.sessionId = crypto.randomBytes(8).toString("hex");
        const ok = {
            role: "server",
            sessionId: this.sessionId,
            maxFrame: C.MAX_FRAME,
        };
        this._writeCipher(C.TYPE_AUTH_OK, Buffer.from(JSON.stringify(ok), "utf8"));
        this._log("【握手】完成  mode=" + mode + "  sessionId=" + this.sessionId);
    }

    async _handshakeClient() {
        const pinMode = this.uri.pinMode;
        this._log("【握手】本地模式=" + (pinMode ? "PIN" : "PSK"));

        await this.readExpect(C.TYPE_HELLO);
        const hello = {
            ver: 1,
            role: "client",
            caps: ["text"],
            auth: pinMode ? "pin" : "psk",
        };
        this._writePlain(C.TYPE_HELLO, hello);

        const clientNonce = crypto.randomBytes(C.NONCE_LEN);
        const kx = {};
        let kp = null;
        if (pinMode) {
            kp = Ecdh.generate();
            kx.mode = "pin";
            kx.curve = C.CURVE;
            kx.pub = B64.enc(Ecdh.encodePublic(kp));
            kx.nonce = B64.enc(clientNonce);
        } else {
            kx.mode = "psk";
            kx.nonce = B64.enc(clientNonce);
        }
        this._writePlain(C.TYPE_KEY_EXCHANGE, kx);

        const skxFrame = await this.readExpect(C.TYPE_KEY_EXCHANGE);
        const skx = JSON.parse(skxFrame.payload.toString("utf8"));
        const serverNonce = B64.dec(skx.nonce);

        if (pinMode) {
            const serverPub = B64.dec(skx.pub);
            const shared = Ecdh.sharedSecret(kp, serverPub);
            const salt = Buffer.concat([serverNonce, clientNonce]);
            const info = C.HKDF_INFO_PIN_PREFIX + TsUri.pinOf(this.uri);
            this.aesKey = Hkdf.derive(shared, salt, info, C.PSK_LEN);
        } else {
            const salt = Buffer.concat([serverNonce, clientNonce]);
            this.aesKey = Hkdf.derive(this.uri.psk, salt, C.HKDF_INFO_PSK, C.PSK_LEN);
        }

        this._writeCipher(C.TYPE_AUTH_OK, Buffer.from(JSON.stringify({ role: "client" }), "utf8"));
        const ok = await this.readExpect(C.TYPE_AUTH_OK);
        const serverOk = JSON.parse(AesGcm.open(this.aesKey, ok.payload).toString("utf8"));
        this.sessionId = serverOk.sessionId;
        this._log("【握手】完成  sessionId=" + this.sessionId);
    }

    _handleSession(f) {
        if (f.version !== C.VERSION) {
            this._fail(new Error("bad version"));
            return;
        }
        let plain;
        try {
            plain = AesGcm.open(this.aesKey, f.payload);
        } catch (e) {
            this._fail(e);
            return;
        }
        if (f.type === C.TYPE_TEXT) {
            const text = plain.toString("utf8");
            this._log("【接收】TEXT <= " + text);
            this._writeCipher(C.TYPE_ACK, Buffer.from(JSON.stringify({ ok: true }), "utf8"));
            if (this.onText) {
                try {
                    this.onText(text);
                } catch (e) {
                    console.log("onText: " + e);
                }
            }
        } else if (f.type === C.TYPE_ACK) {
            this._log("【接收反馈】ACK");
            if (this.waitingAck) {
                const w = this.waitingAck;
                this.waitingAck = null;
                clearTimeout(w.timer);
                w.resolve();
            }
        } else if (f.type === C.TYPE_ERROR) {
            this._log("peer ERROR: " + plain.toString("utf8"));
        }
    }

    sendText(text) {
        if (!this.aesKey || !this.handshakeOk) {
            return Promise.reject(new Error("not ready"));
        }
        const body = text == null ? "" : String(text);
        this._log("【发送】TEXT => " + body);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.waitingAck = null;
                reject(new Error(this.alive ? "ACK timeout" : "disconnected before ACK"));
            }, C.ACK_TIMEOUT_MS);
            this.waitingAck = { resolve, reject, timer };
            try {
                this._writeCipher(C.TYPE_TEXT, Buffer.from(body, "utf8"));
            } catch (e) {
                this.waitingAck = null;
                clearTimeout(timer);
                reject(e);
            }
        }).then(() => {
            if (this.waitingAck && this.waitingAck.timer) {
                clearTimeout(this.waitingAck.timer);
            }
        });
    }

    close() {
        if (!this.alive) {
            return;
        }
        this.alive = false;
        if (this._handshakeTimer) {
            clearTimeout(this._handshakeTimer);
            this._handshakeTimer = null;
        }
        if (this.waitingAck) {
            const w = this.waitingAck;
            this.waitingAck = null;
            clearTimeout(w.timer);
            w.reject(new Error("disconnected before ACK"));
        }
        while (this.waiters.length) {
            const w = this.waiters.shift();
            w.reject(new Error("closed"));
        }
        try {
            this.socket.destroy();
        } catch (e) {
            /* ignore */
        }
        if (this.onClosed) {
            try {
                this.onClosed();
            } catch (e) {
                /* ignore */
            }
        }
    }

    _writePlain(type, obj) {
        writeFrame(this.socket, type, Buffer.from(JSON.stringify(obj), "utf8"));
    }

    _writeCipher(type, plainBuf) {
        writeFrame(this.socket, type, AesGcm.seal(this.aesKey, plainBuf));
    }

    _fail(e) {
        this._log("【会话】出错: " + (e && e.message ? e.message : e));
        this.close();
    }

    _log(s) {
        console.log("Log: " + s);
    }
}

module.exports = { TsPeer };
