"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const C = require("./constants");
const B64 = require("./b64");
const AesGcm = require("./aesGcm");
const Hkdf = require("./hkdf");
const Ecdh = require("./ecdh");
const TsUri = require("./tsUri");
const { writeFrame, writeFrameWait, FrameReader } = require("./frame");
const FileNames = require("./fileNames");
const FileIds = require("./fileIds");
const ResumeFiles = require("./resumeFiles");

function copyImage(filePath) {
    try {
        if (typeof utools !== "undefined" && typeof utools.copyImage === "function") {
            return !!utools.copyImage(filePath);
        }
    } catch (e) {
        /* ignore */
    }
    return false;
}

class TsPeer {
    constructor(socket, opts) {
        this.socket = socket;
        this.asServer = !!opts.asServer;
        this.material = opts.material || null;
        this.uri = opts.uri || null;
        this.onReady = opts.onReady || null;
        this.onClosed = opts.onClosed || null;
        this.onText = opts.onText || null;
        this.onFileIo = opts.onFileIo || null;
        this.reader = new FrameReader();
        this.waiters = [];
        this.phase = "handshake";
        this.alive = true;
        this.handshakeOk = false;
        this.aesKey = null;
        this.sessionId = "";
        this.waitingAck = null;
        this._handshakeTimer = null;
        this.peerHasFile = false;
        this.inbox = null;
        this.treeRoots = new Map();
        this.outgoingFileId = null;
        this.outgoingSeq = 0;
        this.outgoingOf = 0;
        this.cancelOutgoing = false;
        this.cancelEpoch = 0;
        this.lastIncomingFileId = "";
        this.pendingControl = null;
        this._controlWait = null;
        this.incomingCancelStreak = 0;
        this.receiveAbortUntil = 0;
        this.cancelledPeerFileIds = new Set();
        this._ioChain = Promise.resolve();

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

    supportsFile() {
        return this.peerHasFile;
    }

    setFileIo(cb) {
        this.onFileIo = cb;
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
            caps: ["text", "file"],
            auth: "psk+pin",
            pinLen: C.PIN_LEN,
        };
        this._writePlain(C.TYPE_HELLO, hello);
        this._log("【握手】发送 HELLO  ver=1 auth=psk+pin");

        const clientHello = await this.readExpect(C.TYPE_HELLO);
        this._parseCaps(JSON.parse(clientHello.payload.toString("utf8")));

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

        const serverHello = await this.readExpect(C.TYPE_HELLO);
        this._parseCaps(JSON.parse(serverHello.payload.toString("utf8")));
        const hello = {
            ver: 1,
            role: "client",
            caps: ["text", "file"],
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

    _parseCaps(hello) {
        this.peerHasFile = false;
        if (hello && Array.isArray(hello.caps)) {
            for (const el of hello.caps) {
                if (el === "file") {
                    this.peerHasFile = true;
                    break;
                }
            }
        }
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
            let ack = {};
            try {
                ack = JSON.parse(plain.toString("utf8"));
            } catch (e) {
                ack = {};
            }
            this._deliverAck(ack);
        } else if (f.type === C.TYPE_ERROR) {
            this._log("peer ERROR: " + plain.toString("utf8"));
        } else if (f.type === C.TYPE_FILE_META) {
            try {
                this._handleFileMeta(plain);
            } catch (e) {
                this._log("FILE_META: " + e);
            }
        } else if (f.type === C.TYPE_FILE_CHUNK) {
            this._handleFileChunk(plain);
        } else if (f.type === C.TYPE_FILE_DONE) {
            try {
                this._handleFileDone(plain);
            } catch (e) {
                this._log("FILE_DONE: " + e);
            }
        } else if (f.type === C.TYPE_FILE_CONTROL) {
            this._handleFileControl(plain);
        }
    }

    sendText(text) {
        if (!this.aesKey || !this.handshakeOk) {
            return Promise.reject(new Error("not ready"));
        }
        const body = text == null ? "" : String(text);
        this._log("【发送】TEXT => " + body);
        return this._serialize(async () => {
            const wait = this._waitPlainAck(C.ACK_TIMEOUT_MS);
            this._writeCipher(C.TYPE_TEXT, Buffer.from(body, "utf8"));
            await wait;
        });
    }

    sendFile(filePath, cancelled, treeName, relPath, seq, of) {
        return this._serialize(() => this._sendFile(filePath, cancelled, treeName, relPath, seq || 0, of || 0));
    }

    async _sendFile(filePath, cancelled, treeName, relPath, seq, of) {
        if (!this.aesKey || !this.handshakeOk) {
            throw new Error("not ready");
        }
        if (!this.peerHasFile) {
            throw new Error("对端不支持文件传输");
        }
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            throw new Error("不是文件");
        }
        const size = fs.statSync(filePath).size;
        if (size < 0 || size > C.FILE_SIZE_MAX) {
            throw new Error("文件过大");
        }
        let name = FileNames.sanitize(path.basename(filePath));
        if (relPath != null && String(relPath).trim() !== "") {
            const safeRel = FileNames.sanitizeRelPath(relPath);
            if (!safeRel) {
                throw new Error("非法路径");
            }
            const slash = safeRel.lastIndexOf("/");
            name = slash >= 0 ? safeRel.substring(slash + 1) : safeRel;
            relPath = safeRel;
        }
        const image = FileNames.isImageName(name) && !treeName;
        const kind = image ? "image" : "file";
        const disposition = (image && size > 0 && size <= C.CLIPBOARD_IMAGE_MAX) ? "paste" : "save";
        const fileId = FileIds.random();
        const meta = {
            fileId,
            name,
            size,
            chunkSize: C.FILE_CHUNK,
            kind,
            disposition,
        };
        if (treeName && String(treeName).trim()) {
            meta.tree = FileNames.sanitize(treeName);
        }
        if (relPath && String(relPath).trim()) {
            meta.path = relPath;
        }
        if ((cancelled && cancelled()) || this.cancelOutgoing || !this.alive) {
            throw new Error("cancelled");
        }
        meta.headSha256 = ResumeFiles.sha256Head(filePath, size);
        meta.tailSha256 = ResumeFiles.sha256Tail(filePath, size);
        if (seq > 0 && of > 0) {
            meta.seq = seq;
            meta.of = of;
        }
        if ((cancelled && cancelled()) || this.cancelOutgoing || !this.alive) {
            throw new Error("cancelled");
        }
        this._log("【发送】FILE_META " + name + " " + size + "B " + kind + "/" + disposition);

        this.outgoingFileId = fileId;
        this.outgoingSeq = seq;
        this.outgoingOf = of;
        const sendCancelled = () => (cancelled && cancelled()) || this.cancelOutgoing || !this.alive;
        let metaSent = false;
        try {
            await this._writeCipherWait(C.TYPE_FILE_META, Buffer.from(JSON.stringify(meta), "utf8"), sendCancelled);
            metaSent = true;
            const ctrl = await this._waitFileControl(fileId, C.FILE_ACCEPT_TIMEOUT_MS);
            const op = String(ctrl.op || "");
            if (op.toUpperCase() === "REJECT") {
                metaSent = false;
                throw new Error("对端拒绝: " + (ctrl.reason || ""));
            }
            let offset = 0;
            let index = 0;
            if (op.toUpperCase() === "RESUME") {
                offset = Number(ctrl.offset || 0);
                index = Number(ctrl.nextIndex || 0);
                if (offset < 0 || offset > size) {
                    throw new Error("续传偏移无效");
                }
                const expectPrefix = ctrl.prefixSha256 ? String(ctrl.prefixSha256) : "";
                if (offset > 0 && ResumeFiles.isSha256Hex(expectPrefix)) {
                    const localPrefix = ResumeFiles.sha256Prefix(filePath, offset);
                    if (expectPrefix.toLowerCase() !== localPrefix.toLowerCase()) {
                        this._log("【发送】已收前缀不是本文件，从头发 " + name);
                        this._sendControl("RESET", fileId, "prefix");
                        const again = await this._waitFileControl(fileId, C.FILE_ACCEPT_TIMEOUT_MS);
                        if (String(again.op || "").toUpperCase() !== "ACCEPT") {
                            throw new Error("未接受文件: " + again.op);
                        }
                        offset = 0;
                        index = 0;
                    }
                }
                if (offset > 0) {
                    this._log("【发送】RESUME offset=" + offset);
                }
            } else if (op.toUpperCase() !== "ACCEPT") {
                throw new Error("未接受文件: " + op);
            }

            const sha = crypto.createHash("sha256");
            let chunkIndex = index;
            let sent = offset;
            const idBytes = FileIds.toBytes(fileId);
            const fd = fs.openSync(filePath, "r");
            try {
                const buf = Buffer.alloc(C.FILE_CHUNK);
                let skip = offset;
                let pos = 0;
                while (skip > 0) {
                    const n = fs.readSync(fd, buf, 0, Math.min(buf.length, skip), pos);
                    if (n <= 0) {
                        throw new Error("续传跳过失败");
                    }
                    sha.update(buf.subarray(0, n));
                    pos += n;
                    skip -= n;
                }
                if (this.onFileIo && offset > 0) {
                    this.onFileIo.onProgress(false, name, sent, size, this.outgoingSeq, this.outgoingOf);
                }
                while (true) {
                    if (sendCancelled()) {
                        await this._sendControlWait("CANCEL", fileId, null);
                        throw new Error("cancelled");
                    }
                    const n = fs.readSync(fd, buf, 0, buf.length, pos);
                    if (n <= 0) {
                        break;
                    }
                    pos += n;
                    sha.update(buf.subarray(0, n));
                    const idx = Buffer.alloc(4);
                    idx.writeUInt32BE(chunkIndex);
                    await this._writeCipherWait(
                        C.TYPE_FILE_CHUNK,
                        Buffer.concat([idBytes, idx, buf.subarray(0, n)]),
                        sendCancelled
                    );
                    chunkIndex++;
                    sent += n;
                    if (this.onFileIo) {
                        this.onFileIo.onProgress(false, name, sent, size, this.outgoingSeq, this.outgoingOf);
                    }
                }
            } finally {
                fs.closeSync(fd);
            }

            const done = { fileId, sha256: FileIds.shaHex(sha.digest()) };
            if (this.onFileIo && this.onFileIo.onAwaiting) {
                this.onFileIo.onAwaiting(false, name, size, this.outgoingSeq, this.outgoingOf);
            }
            const wait = this._waitFileAck(fileId, C.fileDoneAckMs(size));
            await this._writeCipherWait(
                C.TYPE_FILE_DONE,
                Buffer.from(JSON.stringify(done), "utf8"),
                sendCancelled
            );
            const ack = await wait;
            if (ack && ack.ok === false) {
                throw new Error("对端校验失败: " + (ack.err || ""));
            }
            this._log("【发送】FILE_DONE " + name);
            return true;
        } catch (e) {
            if (metaSent) {
                this._abortPeerReceive(fileId, e);
            }
            throw e;
        } finally {
            this.outgoingFileId = null;
            this.outgoingSeq = 0;
            this.outgoingOf = 0;
            this.cancelOutgoing = false;
        }
    }

    prepareOutgoingSend() {
        this.cancelEpoch++;
        this.cancelOutgoing = false;
        this._dropStaleFileControl();
    }

    cancelFile() {
        const epoch = this.cancelEpoch;
        const outId = this.outgoingFileId;
        const box = this.inbox;
        const inId = box ? box.fileId : this.lastIncomingFileId;
        this.cancelOutgoing = true;
        const incoming = box != null || (inId && !outId);
        if (incoming) {
            this.incomingCancelStreak++;
            if (this.incomingCancelStreak >= C.FILE_CANCEL_COOLDOWN_AFTER) {
                this.incomingCancelStreak = 0;
                this.receiveAbortUntil = Date.now() + C.FILE_CANCEL_COOLDOWN_MS;
                if (this.onFileIo) {
                    this.onFileIo.onReceiveFailed("", "冷却中，" + (C.FILE_CANCEL_COOLDOWN_MS / 1000) + "秒内不再接收");
                }
            }
        }
        if (box) {
            this._failInbox(box, "已取消", true);
        }
        if (this._controlWait) {
            const w = this._controlWait;
            this._controlWait = null;
            clearTimeout(w.timer);
            w.reject(new Error("cancelled"));
        }
        if (this.waitingAck) {
            const w = this.waitingAck;
            this.waitingAck = null;
            clearTimeout(w.timer);
            w.reject(new Error("cancelled"));
        }
        setImmediate(() => {
            if (epoch !== this.cancelEpoch) {
                return;
            }
            (async () => {
                try {
                    if (outId) {
                        await this._sendControlWait("CANCEL", outId, "abort");
                    }
                    if (inId && inId !== outId) {
                        await this._sendControlWait("CANCEL", inId, "abort");
                    }
                } catch (e) {
                    this._log("cancelFile send: " + e);
                }
            })();
        });
    }

    _handleFileMeta(plain) {
        const meta = JSON.parse(plain.toString("utf8"));
        const fileId = meta.fileId ? String(meta.fileId) : "";
        let name = FileNames.sanitize(meta.name ? String(meta.name) : "file");
        const size = meta.size != null ? Number(meta.size) : -1;
        const kind = meta.kind ? String(meta.kind) : "file";
        const disposition = meta.disposition ? String(meta.disposition) : "save";
        let tree = meta.tree ? FileNames.sanitize(String(meta.tree)) : null;
        if (tree != null && tree.trim() === "") {
            tree = null;
        }
        const rel = meta.path ? FileNames.sanitizeRelPath(String(meta.path)) : null;
        const headSha = meta.headSha256 ? String(meta.headSha256) : "";
        const tailSha = meta.tailSha256 ? String(meta.tailSha256) : "";
        let seq = 0;
        let of = 0;
        if (meta.seq != null && meta.of != null) {
            seq = Number(meta.seq) || 0;
            of = Number(meta.of) || 0;
        }
        if (seq < 1 || of < 1) {
            seq = 0;
            of = 0;
        }
        this._log("【接收】FILE_META " + name + " " + size + "B");

        if (this.inbox) {
            this._failInbox(this.inbox, "已取消", true);
        }
        this.cancelEpoch++;
        this.cancelOutgoing = false;
        this.cancelledPeerFileIds.clear();
        this.lastIncomingFileId = fileId;

        if (Date.now() < this.receiveAbortUntil) {
            this._sendControl("REJECT", fileId, "cooldown");
            if (this.onFileIo) {
                this.onFileIo.onReceiveFailed(name, "冷却中");
            }
            return;
        }

        if (fileId.length !== C.FILE_ID_LEN * 2 || size < 0 || size > C.FILE_SIZE_MAX) {
            this._sendControl("REJECT", fileId, "meta");
            return;
        }
        if (meta.tree && (!tree || !rel)) {
            this._sendControl("REJECT", fileId, "path");
            return;
        }
        try {
            let destDir = FileNames.inboxDir();
            if (tree) {
                destDir = this._resolveTreeRoot(tree);
                const dest = FileNames.resolveUnder(destDir, rel);
                destDir = path.dirname(dest);
                fs.mkdirSync(destDir, { recursive: true });
                name = path.basename(dest);
            }
            const opened = Inbox.open(fileId, name, size, kind, disposition, destDir, headSha, tailSha, seq, of);
            this.inbox = opened;
            this.lastIncomingFileId = fileId;
            if (opened.resuming) {
                this._sendResume(fileId, opened.written, opened.nextIndex, opened.partPath);
                if (this.onFileIo) {
                    this.onFileIo.onProgress(true, name, opened.written, size, opened.seq, opened.of);
                }
                return;
            }
        } catch (e) {
            if (this.inbox) {
                this._failInbox(this.inbox, e.message, false);
            } else if (this.onFileIo) {
                this.onFileIo.onReceiveFailed(name, e.message || "失败");
            }
            const reason = e && e.message && String(e.message).startsWith("disk") ? "disk" : "io";
            this._sendControl("REJECT", fileId, reason);
            return;
        }
        this._sendControl("ACCEPT", fileId, null);
        if (this.onFileIo) {
            this.onFileIo.onProgress(true, name, 0, size, seq, of);
        }
    }

    _resolveTreeRoot(tree) {
        if (this.treeRoots.has(tree)) {
            return this.treeRoots.get(tree);
        }
        const inboxDir = FileNames.inboxDir();
        const named = path.join(inboxDir, tree);
        const mark = path.join(named, ".textsend.receiving");
        let dir;
        if (fs.existsSync(named) && fs.statSync(named).isDirectory()
            && (fs.existsSync(mark) || ResumeFiles.hasIncomplete(named))) {
            dir = named;
        } else {
            dir = FileNames.uniqueDir(inboxDir, tree);
        }
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, ".textsend.receiving"), "1");
        this.treeRoots.set(tree, dir);
        return dir;
    }

    _handleFileChunk(plain) {
        const box = this.inbox;
        if (!box || plain.length < C.FILE_ID_LEN + 4) {
            return;
        }
        const id = FileIds.toHex(plain.subarray(0, C.FILE_ID_LEN));
        if (this.cancelledPeerFileIds.has(id)) {
            return;
        }
        if (box.fileId !== id) {
            return;
        }
        const index = plain.readUInt32BE(C.FILE_ID_LEN);
        const dataOff = C.FILE_ID_LEN + 4;
        const n = plain.length - dataOff;
        if (index !== box.nextIndex || n < 0 || n > C.FILE_CHUNK_MAX) {
            this._failInbox(box, "分片异常", true);
            this._sendControl("CANCEL", box.fileId, null);
            return;
        }
        if (box.written + n > box.size) {
            this._failInbox(box, "超出声明大小", true);
            this._sendControl("CANCEL", box.fileId, null);
            return;
        }
        try {
            if (!box.fd) {
                return;
            }
            fs.writeSync(box.fd, plain, dataOff, n);
            box.sha.update(plain.subarray(dataOff, dataOff + n));
        } catch (e) {
            if (this.inbox !== box || this.cancelOutgoing) {
                return;
            }
            this._failInbox(box, e.message, true);
            try {
                this._sendControl("REJECT", box.fileId, "io");
            } catch (ignored) {
                /* ignore */
            }
            return;
        }
        box.written += n;
        box.nextIndex++;
        if (this.onFileIo) {
            this.onFileIo.onProgress(true, box.name, box.written, box.size, box.seq, box.of);
        }
    }

    _handleFileDone(plain) {
        const done = JSON.parse(plain.toString("utf8"));
        const fileId = done.fileId ? String(done.fileId) : "";
        const expectSha = done.sha256 ? String(done.sha256) : "";
        const box = this.inbox;
        if (!box || box.fileId !== fileId) {
            this._writeAck(false, fileId, "no-inbox");
            return;
        }
        try {
            box.closeOut();
            if (fs.statSync(box.partPath).size !== box.size) {
                throw new Error("大小不符");
            }
            const got = FileIds.shaHex(box.sha.digest());
            if (expectSha && expectSha.toLowerCase() !== got.toLowerCase()) {
                throw new Error("sha256");
            }
            const wantPaste = String(box.disposition).toLowerCase() === "paste"
                && String(box.kind).toLowerCase() === "image"
                && box.size > 0 && box.size <= C.CLIPBOARD_IMAGE_MAX;
            if (wantPaste && copyImage(box.partPath)) {
                try {
                    fs.rmSync(box.partPath, { force: true });
                } catch (e) {
                    /* ignore */
                }
                ResumeFiles.delete(box.dir, box.name);
                this.inbox = null;
                this.incomingCancelStreak = 0;
                this._writeAck(true, fileId, null);
                if (this.onFileIo) {
                    this.onFileIo.onReceived(box.name, "剪贴板");
                }
                this._log("【接收】图片进剪贴板 " + box.name);
                return;
            }
            const dest = FileNames.unique(box.dir, box.name);
            fs.renameSync(box.partPath, dest);
            ResumeFiles.delete(box.dir, box.name);
            this.inbox = null;
            this.incomingCancelStreak = 0;
            this._writeAck(true, fileId, null);
            if (this.onFileIo) {
                this.onFileIo.onReceived(box.name, dest);
            }
            this._log("【接收】已保存 " + dest);
        } catch (e) {
            this._failInbox(box, e.message, true);
            this._writeAck(false, fileId, e.message);
        }
    }

    _handleFileControl(plain) {
        let o;
        try {
            o = JSON.parse(plain.toString("utf8"));
        } catch (e) {
            return;
        }
        const op = String(o.op || "");
        const fileId = o.fileId ? String(o.fileId) : "";
        this._log("【接收】FILE_CONTROL " + op + " " + fileId);
        if (op.toUpperCase() === "RESET") {
            const box = this.inbox;
            if (box && box.fileId === fileId) {
                try {
                    box.resetToStart();
                    this._sendControl("ACCEPT", fileId, null);
                    this._log("【接收】RESET 从头收 " + box.name);
                } catch (e) {
                    this._failInbox(box, e.message, true);
                    try {
                        this._sendControl("REJECT", fileId, "io");
                    } catch (ignored) {
                        /* ignore */
                    }
                }
            }
        } else if (op.toUpperCase() === "CANCEL") {
            const matchOut = this.outgoingFileId
                && (!fileId || this.outgoingFileId.toLowerCase() === fileId.toLowerCase());
            if (matchOut) {
                this.cancelOutgoing = true;
            }
            const box = this.inbox;
            if (box && (!fileId || box.fileId.toLowerCase() === fileId.toLowerCase())) {
                this.cancelledPeerFileIds.add(box.fileId);
                this._failInbox(box, "对端取消", false);
            }
        }
        const keep = !(op.toUpperCase() === "CANCEL")
            || !fileId
            || (this.outgoingFileId && this.outgoingFileId.toLowerCase() === fileId.toLowerCase());
        if (this._controlWait) {
            const w = this._controlWait;
            const id = fileId;
            if (op.toUpperCase() === "CANCEL" && (!id || w.fileId.toLowerCase() === id.toLowerCase())) {
                this._controlWait = null;
                clearTimeout(w.timer);
                this.cancelOutgoing = true;
                w.reject(new Error("cancelled"));
                return;
            }
            if (w.fileId.toLowerCase() === id.toLowerCase()) {
                this._controlWait = null;
                clearTimeout(w.timer);
                w.resolve(o);
                return;
            }
        }
        if (keep) {
            this.pendingControl = o;
        }
    }

    _waitFileControl(fileId, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (!this.alive || this.cancelOutgoing) {
                reject(new Error(this.cancelOutgoing ? "cancelled" : "disconnected"));
                return;
            }
            if (this.pendingControl) {
                const m = this.pendingControl;
                this.pendingControl = null;
                const op = String(m.op || "");
                const id = m.fileId ? String(m.fileId) : "";
                if (op.toUpperCase() === "CANCEL" && (!id || fileId.toLowerCase() === id.toLowerCase())) {
                    this.cancelOutgoing = true;
                    reject(new Error("cancelled"));
                    return;
                }
                if (fileId.toLowerCase() === id.toLowerCase()) {
                    resolve(m);
                    return;
                }
            }
            const timer = setTimeout(() => {
                if (this._controlWait && this._controlWait.fileId === fileId) {
                    this._controlWait = null;
                }
                reject(new Error("对端未接受（可能还不支持文件）"));
            }, timeoutMs);
            this._controlWait = { fileId, resolve, reject, timer };
        });
    }

    _dropStaleFileControl() {
        if (!this.pendingControl) {
            return;
        }
        const op = String(this.pendingControl.op || "").toUpperCase();
        if (op === "CANCEL" || op === "REJECT") {
            this.pendingControl = null;
        }
    }

    _abortPeerReceive(fileId, e) {
        const msg = e && e.message ? String(e.message) : "";
        if (msg.startsWith("对端拒绝") || msg.includes("ACK timeout")
            || msg.includes("校验失败") || msg === "cancelled") {
            return;
        }
        try {
            this._sendControl("CANCEL", fileId, "abort");
        } catch (ignored) {
            /* ignore */
        }
    }

    _sendControl(op, fileId, reason) {
        if (!this.handshakeOk || !this.aesKey) {
            return;
        }
        const o = { op };
        if (fileId) {
            o.fileId = fileId;
        }
        if (reason) {
            o.reason = reason;
        }
        this._writeCipher(C.TYPE_FILE_CONTROL, Buffer.from(JSON.stringify(o), "utf8"));
    }

    async _sendControlWait(op, fileId, reason) {
        if (!this.handshakeOk || !this.aesKey) {
            return;
        }
        const o = { op };
        if (fileId) {
            o.fileId = fileId;
        }
        if (reason) {
            o.reason = reason;
        }
        await this._writeCipherWait(C.TYPE_FILE_CONTROL, Buffer.from(JSON.stringify(o), "utf8"), null);
    }

    async _writeCipherWait(type, plainBuf, cancelled) {
        await writeFrameWait(this.socket, type, AesGcm.seal(this.aesKey, plainBuf), cancelled);
    }

    _sendResume(fileId, offset, nextIndex, part) {
        const o = { op: "RESUME", fileId, offset, nextIndex };
        if (offset > 0 && part) {
            o.prefixSha256 = ResumeFiles.sha256Prefix(part, offset);
        }
        this._writeCipher(C.TYPE_FILE_CONTROL, Buffer.from(JSON.stringify(o), "utf8"));
    }

    _writeAck(ok, fileId, err) {
        const ack = { ok };
        if (fileId) {
            ack.id = fileId;
        }
        if (err) {
            ack.err = err;
        }
        this._writeCipher(C.TYPE_ACK, Buffer.from(JSON.stringify(ack), "utf8"));
    }

    _failInbox(box, err, del) {
        if (!box) {
            return;
        }
        if (this.inbox === box) {
            this.inbox = null;
        }
        box.closeQuiet();
        if (del) {
            ResumeFiles.delete(box.dir, box.name);
        } else {
            ResumeFiles.save(box.dir, box.name, box.size, box.written, box.nextIndex, box.headSha, box.tailSha);
        }
        if (this.onFileIo) {
            this.onFileIo.onReceiveFailed(box.name, del ? (err || "失败") : "传输中断，可续传");
        }
    }

    _deliverAck(ack) {
        const w = this.waitingAck;
        if (!w) {
            return;
        }
        if (w.expectId) {
            const got = ack && ack.id != null ? String(ack.id) : "";
            if (!got || got.toLowerCase() !== String(w.expectId).toLowerCase()) {
                return;
            }
        }
        this.waitingAck = null;
        clearTimeout(w.timer);
        w.resolve(ack || {});
    }

    _waitPlainAck(timeoutMs) {
        return this._waitAck(timeoutMs, null);
    }

    _waitFileAck(fileId, timeoutMs) {
        return this._waitAck(timeoutMs, fileId);
    }

    _waitAck(timeoutMs, expectId = null) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (this.waitingAck && this.waitingAck.timer === timer) {
                    this.waitingAck = null;
                }
                reject(new Error(this.alive ? "ACK timeout" : "disconnected before ACK"));
            }, timeoutMs);
            this.waitingAck = {
                expectId,
                resolve,
                reject,
                timer,
            };
        });
    }

    _serialize(fn) {
        const run = this._ioChain.then(() => fn(), () => fn());
        this._ioChain = run.catch(() => {});
        return run;
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
        if (this.inbox) {
            this._failInbox(this.inbox, "连接断开", false);
        }
        if (this.waitingAck) {
            const w = this.waitingAck;
            this.waitingAck = null;
            clearTimeout(w.timer);
            w.reject(new Error("disconnected before ACK"));
        }
        if (this._controlWait) {
            const w = this._controlWait;
            this._controlWait = null;
            clearTimeout(w.timer);
            w.reject(new Error("closed"));
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
        for (const dir of this.treeRoots.values()) {
            try {
                if (!ResumeFiles.hasIncomplete(dir)) {
                    fs.rmSync(path.join(dir, ".textsend.receiving"), { force: true });
                }
            } catch (e) {
                /* ignore */
            }
        }
        this.treeRoots.clear();
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

class Inbox {
    constructor(fileId, name, size, kind, disposition, headSha, tailSha, seq, of,
                dir, partPath, fd, written, nextIndex, resuming) {
        this.fileId = fileId;
        this.name = name;
        this.size = size;
        this.kind = kind;
        this.disposition = disposition;
        this.headSha = headSha;
        this.tailSha = tailSha;
        this.seq = seq;
        this.of = of;
        this.dir = dir;
        this.partPath = partPath;
        this.fd = fd;
        this.written = written;
        this.nextIndex = nextIndex;
        this.resuming = resuming;
        this.sha = crypto.createHash("sha256");
        Inbox.feedPrefix(this.sha, partPath, written);
    }

    static open(fileId, name, size, kind, disposition, dir, headSha, tailSha, seq, of) {
        try {
            if (typeof fs.statfsSync === "function") {
                const st = fs.statfsSync(dir);
                const usable = Number(st.bavail) * Number(st.bsize);
                if (usable < size + 1024 * 1024) {
                    throw new Error("disk");
                }
            }
        } catch (e) {
            if (e && e.message === "disk") {
                throw e;
            }
        }
        const part = ResumeFiles.partPath(dir, name);
        const saved = ResumeFiles.load(dir, name, size);
        if (saved && fs.existsSync(part) && ResumeFiles.identityMatches(saved, part, size, headSha, tailSha)) {
            const onDisk = fs.statSync(part).size;
            let written = Math.min(onDisk, saved.written != null ? Number(saved.written) : onDisk);
            written = ResumeFiles.align(written);
            if (written > 0 && written <= size) {
                if (onDisk !== written) {
                    fs.truncateSync(part, written);
                }
                const nextIndex = Math.floor(written / C.FILE_CHUNK);
                const fd = fs.openSync(part, "a");
                ResumeFiles.save(dir, name, size, written, nextIndex, headSha, tailSha);
                console.log("Log: 【接收】续传 " + name + " offset=" + written);
                return new Inbox(fileId, name, size, kind, disposition, headSha, tailSha, seq, of,
                    dir, part, fd, written, nextIndex, true);
            }
        }
        if (saved && fs.existsSync(part) && !ResumeFiles.identityMatches(saved, part, size, headSha, tailSha)) {
            console.log("Log: 【接收】同名同大小但不是同一文件，不续传 " + name);
        }
        ResumeFiles.delete(dir, name);
        const fd = fs.openSync(part, "w");
        ResumeFiles.save(dir, name, size, 0, 0, headSha, tailSha);
        return new Inbox(fileId, name, size, kind, disposition, headSha, tailSha, seq, of,
            dir, part, fd, 0, 0, false);
    }

    resetToStart() {
        this.closeOut();
        fs.truncateSync(this.partPath, 0);
        this.fd = fs.openSync(this.partPath, "w");
        this.written = 0;
        this.nextIndex = 0;
        this.sha = crypto.createHash("sha256");
        ResumeFiles.save(this.dir, this.name, this.size, 0, 0, this.headSha, this.tailSha);
    }

    static feedPrefix(digest, part, written) {
        if (written <= 0 || !part || !fs.existsSync(part)) {
            return;
        }
        const fd = fs.openSync(part, "r");
        try {
            const buf = Buffer.alloc(64 * 1024);
            let left = written;
            let pos = 0;
            while (left > 0) {
                const n = fs.readSync(fd, buf, 0, Math.min(buf.length, left), pos);
                if (n <= 0) {
                    throw new Error("续传前缀不完整");
                }
                digest.update(buf.subarray(0, n));
                pos += n;
                left -= n;
            }
        } finally {
            fs.closeSync(fd);
        }
    }

    closeOut() {
        if (this.fd != null) {
            fs.closeSync(this.fd);
            this.fd = null;
        }
    }

    closeQuiet() {
        try {
            this.closeOut();
        } catch (e) {
            /* ignore */
        }
    }
}

module.exports = { TsPeer };
