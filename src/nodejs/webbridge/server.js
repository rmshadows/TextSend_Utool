"use strict";

/**
 * 网页桥。A 明文 HTTP，B HTTP + AES-GCM，C HTTPS + 同一套 AES-GCM。
 * 与 ts:// 的 54300 分开，默认端口 54301，三档同时只开一个。
 */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const aes = require("../protocol/aesGcm");
const b64 = require("../protocol/b64");
const hkdf = require("../protocol/hkdf");
const C = require("../protocol/constants");
const FileNames = require("../protocol/fileNames");
const inbox = require("./inbox");
const outbox = require("./outbox");
const lanCert = require("./lanCert");

const DEFAULT_PORT = 54301;
const INFO = "textsend-webbridge-v1";
const IDLE_MS = 60 * 60 * 1000;
const MAX_PLAIN = 64 * 1024;
const MAX_SEALED = MAX_PLAIN + 4096;
const MAX_JSON = MAX_PLAIN + 4096;
const MAX_CLIENTS = 8;
const PING_MS = 15 * 1000;
const MAX_OUTBOUND = 20;
const WARN = "消息以明文在局域网传输，同一网络中的其他人可能看到内容。请仅在可信网络使用；不要发送密码、验证码等敏感信息。";

const state = {
    server: null,
    way: "",
    port: 0,
    sid: null,
    token: null,
    ikm: null,
    aesKey: null,
    touched: 0,
    clients: [],
    outbound: [],
    timer: null,
    hooks: {},
};

function appVersion() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, "../../../plugin.json"), "utf8");
        const v = JSON.parse(raw).version;
        if (v) {
            return String(v);
        }
    } catch (e) {
        /* 插件清单读不到时用当前发行号 */
    }
    return "5.0.15";
}

function staticRoot() {
    return path.join(__dirname, "../../../webbridge");
}

function setHooks(next) {
    state.hooks = next || {};
}

function isRunning() {
    return state.server != null;
}

function hasSession() {
    if (state.way === "A") {
        return state.token != null && state.sid != null;
    }
    return state.aesKey != null && state.sid != null;
}

function way() {
    return isRunning() ? state.way : "";
}

function port() {
    return state.port;
}

function listenerCount() {
    return state.clients.length;
}

function listenerHosts() {
    return state.clients.map((c) => c.host);
}

function caPath() {
    if (state.way !== "C" || !isRunning()) {
        return "";
    }
    try {
        return lanCert.caCertificatePath();
    } catch (e) {
        return "";
    }
}

function pageUrl(host) {
    if (!isRunning() || !hasSession() || !state.sid) {
        return null;
    }
    let h = host == null ? "" : String(host).trim();
    if (!h) {
        h = "127.0.0.1";
    }
    if (h.indexOf(":") >= 0 && !h.startsWith("[")) {
        h = "[" + h + "]";
    }
    const scheme = state.way === "C" ? "https" : "http";
    if (state.way === "A") {
        return scheme + "://" + h + ":" + state.port + "/?s=" + state.sid + "&t=" + state.token + "&m=A";
    }
    return scheme + "://" + h + ":" + state.port + "/?s=" + state.sid + "#k=" + b64.enc(state.ikm);
}

async function start(listenPort, listenWay) {
    const w = String(listenWay || "B").toUpperCase();
    if (w !== "A" && w !== "B" && w !== "C") {
        throw new Error("档位无效");
    }
    const p = Number(listenPort);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
        throw new Error("端口无效");
    }
    if (state.server && state.way === w) {
        if (state.port === p) {
            return;
        }
        await rebind(p);
        return;
    }
    await shutdown(true);
    state.way = w;
    try {
        await bind(p);
        mint();
    } catch (e) {
        await shutdown(true);
        throw e;
    }
}

async function rebind(p) {
    await closeHttp();
    await bind(p);
}

function stop() {
    return shutdown(true);
}

function refreshSession() {
    if (!isRunning()) {
        return;
    }
    dropClients("refreshed");
    inbox.discardAll();
    outbox.discardAll();
    mint();
}

function pushText(text) {
    if (text == null) {
        return 0;
    }
    const raw = Buffer.from(String(text), "utf8");
    if (raw.length > MAX_PLAIN) {
        return -1;
    }
    if (!hasSession()) {
        return 0;
    }
    const obj = {
        v: 1,
        type: "text",
        id: crypto.randomUUID(),
        ts: Date.now(),
        body: String(text),
    };
    state.touched = Date.now();
    const ev = sse("msg", encodeEvent(Buffer.from(JSON.stringify(obj), "utf8")));
    state.outbound.push(ev);
    while (state.outbound.length > MAX_OUTBOUND) {
        state.outbound.shift();
    }
    fanout(ev);
    return 1;
}

async function pushFile(filePath, tree, rel, cancelled, progress) {
    if (!hasSession()) {
        return 0;
    }
    let item;
    try {
        item = await outbox.offer(filePath, tree, rel, cancelled, progress);
    } catch (e) {
        const m = e && e.message ? e.message : "";
        if (m === "size") {
            return -1;
        }
        if (m === "full") {
            return -2;
        }
        throw e;
    }
    try {
        if (!publish(outbox.eventOf(item, "file"))) {
            outbox.drop(item.id);
            return 0;
        }
    } catch (e) {
        outbox.drop(item.id);
        throw e;
    }
    return 1;
}

function publish(obj) {
    if (!hasSession()) {
        return false;
    }
    state.touched = Date.now();
    const ev = sse("msg", encodeEvent(Buffer.from(JSON.stringify(obj), "utf8")));
    fanout(ev);
    return true;
}

function encodeEvent(plain) {
    if (state.way === "A") {
        return plain.toString("utf8");
    }
    return aes.seal(state.aesKey, plain).toString("base64");
}

function fanout(ev) {
    const copy = state.clients.slice();
    for (const c of copy) {
        if (!c.write(ev)) {
            drop(c);
        }
    }
}

function sse(event, data) {
    return Buffer.from("event: " + event + "\ndata: " + data + "\n\n", "utf8");
}

function mint() {
    const sid = b64.enc(crypto.randomBytes(16));
    state.sid = sid;
    state.touched = Date.now();
    state.outbound = [];
    if (state.way === "A") {
        state.token = b64.enc(crypto.randomBytes(16));
        if (state.ikm) {
            state.ikm.fill(0);
        }
        state.ikm = null;
        state.aesKey = null;
        return;
    }
    const material = crypto.randomBytes(32);
    state.token = null;
    state.ikm = material;
    state.aesKey = hkdf.derive(material, Buffer.from(sid, "utf8"), INFO, 32);
}

function ensureTimer() {
    if (state.timer) {
        return;
    }
    state.timer = setInterval(tick, PING_MS);
    if (state.timer.unref) {
        state.timer.unref();
    }
}

function tick() {
    if (!state.server) {
        return;
    }
    if (hasSession() && state.clients.length === 0 && Date.now() - state.touched >= IDLE_MS) {
        expireSession();
        return;
    }
    const ping = Buffer.from(": ping\n\n", "utf8");
    const copy = state.clients.slice();
    for (const c of copy) {
        if (!c.write(ping)) {
            drop(c);
        }
    }
}

function expireSession() {
    dropClients("expired");
    inbox.discardAll();
    outbox.discardAll();
    state.aesKey = null;
    state.token = null;
    if (state.ikm) {
        state.ikm.fill(0);
    }
    state.ikm = null;
    state.outbound = [];
}

function dropClients(reason) {
    const copy = state.clients.slice();
    state.clients = [];
    const bye = sse("bye", reason);
    for (const c of copy) {
        c.write(bye);
        c.close();
    }
}

async function bind(p) {
    let server;
    if (state.way === "C") {
        let mat;
        try {
            mat = lanCert.material();
        } catch (e) {
            throw new Error(e && e.message ? e.message : "证书失败");
        }
        server = https.createServer({ key: mat.key, cert: mat.cert }, onRequest);
    } else {
        server = http.createServer(onRequest);
    }
    try {
        await listen(server, p);
    } catch (e) {
        try {
            server.close();
        } catch (e2) {
            /* ignore */
        }
        const msg = e && e.code === "EADDRINUSE"
            ? "端口 " + p + " 无法监听（可能被占用）"
            : (e && e.message ? e.message : "启动失败");
        throw new Error(msg);
    }
    state.server = server;
    state.port = server.address().port;
    ensureTimer();
}

function listen(server, p) {
    return new Promise((resolve, reject) => {
        const onErr = (err) => {
            server.removeListener("listening", onOk);
            reject(err);
        };
        const onOk = () => {
            server.removeListener("error", onErr);
            resolve();
        };
        server.once("error", onErr);
        server.once("listening", onOk);
        server.listen(p);
    });
}

async function closeHttp() {
    dropClients("stop");
    const server = state.server;
    state.server = null;
    if (!server) {
        return;
    }
    await new Promise((resolve) => {
        if (typeof server.closeAllConnections === "function") {
            try {
                server.closeAllConnections();
            } catch (e) {
                /* ignore */
            }
        }
        server.close(() => resolve());
        setTimeout(resolve, 300);
    });
}

async function shutdown(clearSession) {
    await closeHttp();
    if (clearSession) {
        state.way = "";
        state.port = 0;
        state.sid = null;
        state.token = null;
        state.aesKey = null;
        if (state.ikm) {
            state.ikm.fill(0);
        }
        state.ikm = null;
        state.outbound = [];
        inbox.discardAll();
        outbox.discardAll();
    }
}

function onRequest(req, res) {
    handle(req, res).catch((e) => {
        if (!res.headersSent) {
            text(res, 500, "error");
        }
        console.log("webbridge " + (e && e.message ? e.message : e));
    });
}

async function handle(req, res) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname || "/";
    if (pathname === "/" || pathname === "/index.html") {
        return staticFile(req, res, "index.html", "text/html; charset=utf-8");
    }
    if (pathname === "/bridge.js") {
        return staticFile(req, res, "bridge.js", "text/javascript; charset=utf-8");
    }
    if (pathname === "/ca.crt") {
        return caCert(req, res);
    }
    if (pathname === "/api/meta") {
        return meta(req, res);
    }
    if (pathname === "/api/send") {
        return sendText(req, res);
    }
    if (pathname === "/api/file/begin") {
        return fileBegin(req, res);
    }
    if (pathname === "/api/file/chunk") {
        return fileChunk(req, res);
    }
    if (pathname === "/api/file/finish") {
        return fileFinish(req, res);
    }
    if (pathname === "/api/file/cancel") {
        return fileCancel(req, res);
    }
    if (pathname === "/api/out/list") {
        return outList(req, res);
    }
    if (pathname === "/api/out/chunk") {
        return outChunk(req, res);
    }
    if (pathname === "/api/out/drop") {
        return outDrop(req, res);
    }
    if (pathname === "/api/out/clear") {
        return outClear(req, res);
    }
    if (pathname === "/api/events") {
        return events(req, res);
    }
    text(res, 404, "not found");
}

function caCert(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        text(res, 405, "method");
        return;
    }
    if (state.way !== "C" || !sessionOk(req)) {
        text(res, 404, "not found");
        return;
    }
    let body;
    try {
        body = fs.readFileSync(lanCert.caCertificatePath());
    } catch (e) {
        text(res, 500, "error");
        return;
    }
    const headers = {
        "Content-Type": "application/x-x509-ca-cert",
        "Content-Disposition": "attachment; filename=\"textsend-ca.crt\"",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
        res.end();
        return;
    }
    res.end(body);
}

function meta(req, res) {
    if (req.method !== "GET") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    const obj = {
        v: 1,
        mode: state.way,
        encrypt: state.way !== "A",
        pageVersion: "1",
        app: appVersion(),
        host: "电脑",
    };
    if (state.way === "A") {
        obj.warning = WARN;
    }
    const body = Buffer.from(JSON.stringify(obj), "utf8");
    res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
    });
    res.end(body);
}

async function sendText(req, res) {
    if (req.method !== "POST") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    const cap = state.way === "A" ? MAX_JSON : MAX_SEALED;
    if (tooLong(req, cap)) {
        text(res, 413, "too big");
        return;
    }
    const buf = await readBody(req, cap);
    if (buf.length === 0 || buf.length > cap) {
        text(res, buf.length > cap ? 413 : 400, "body");
        return;
    }
    let plain = buf;
    if (state.way !== "A") {
        try {
            plain = aes.open(state.aesKey, buf);
        } catch (e) {
            text(res, 400, "seal");
            return;
        }
        if (plain.length > MAX_PLAIN + 1024) {
            text(res, 413, "too big");
            return;
        }
    }
    let body;
    try {
        const obj = JSON.parse(plain.toString("utf8"));
        if (!obj || obj.v !== 1 || obj.type !== "text" || typeof obj.body !== "string") {
            text(res, 400, "type");
            return;
        }
        body = obj.body;
    } catch (e) {
        text(res, 400, "json");
        return;
    }
    if (!body || Buffer.byteLength(body, "utf8") > MAX_PLAIN) {
        text(res, body ? 413 : 400, "text");
        return;
    }
    touch();
    const paste = body;
    try {
        if (state.hooks.onText) {
            state.hooks.onText(paste);
        } else {
            console.log("webbridge text: " + paste);
        }
    } catch (e) {
        console.log("webbridge text hook: " + e);
    }
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
}

async function fileBegin(req, res) {
    if (req.method !== "POST") {
        text(res, 405, "method");
        return;
    }
    const plain = await openBody(req, res, state.way === "A" ? 16 * 1024 : 16 * 1024);
    if (!plain) {
        return;
    }
    let id;
    let name;
    let rel;
    let size;
    let clip;
    try {
        const obj = JSON.parse(plain.toString("utf8"));
        id = obj.id ? String(obj.id) : "";
        name = obj.name ? String(obj.name) : "";
        rel = obj.rel ? String(obj.rel) : "";
        size = obj.size == null ? -1 : Number(obj.size);
        clip = !!obj.clip;
    } catch (e) {
        text(res, 400, "json");
        return;
    }
    let body;
    try {
        body = inbox.begin(id, name, rel, size, clip);
    } catch (e) {
        const m = e && e.message ? e.message : "begin";
        text(res, m === "size" ? 413 : 400, m);
        return;
    }
    touch();
    const raw = Buffer.from(body, "utf8");
    res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    });
    res.end(raw);
}

async function fileChunk(req, res) {
    if (req.method !== "POST") {
        text(res, 405, "method");
        return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const id = url.searchParams.get("id");
    const index = Number(url.searchParams.get("i"));
    if (!Number.isInteger(index)) {
        text(res, 400, "index");
        return;
    }
    const cap = state.way === "A" ? inbox.CHUNK : inbox.CHUNK + 4096;
    if (state.way === "A") {
        if (!sessionOk(req)) {
            text(res, 401, "session");
            return;
        }
        const data = await readBody(req, inbox.CHUNK);
        if (data.length > inbox.CHUNK) {
            text(res, 413, "size");
            return;
        }
        try {
            inbox.chunk(id, index, data);
        } catch (e) {
            chunkError(res, e);
            return;
        }
    } else {
        const plain = await openBody(req, res, cap);
        if (!plain) {
            return;
        }
        try {
            inbox.chunk(id, index, plain);
        } catch (e) {
            chunkError(res, e);
            return;
        }
    }
    touch();
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
}

function chunkError(res, e) {
    const m = e && e.message ? e.message : "chunk";
    const code = m === "cancelled" || m === "order" ? 409
        : (m === "size" ? 413 : (m === "missing" ? 404 : 400));
    text(res, code, m);
}

function fileCancel(req, res) {
    if (req.method !== "POST") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    inbox.pause(url.searchParams.get("id") || "");
    touch();
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
}

function fileFinish(req, res) {
    if (req.method !== "POST") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    let saved;
    try {
        saved = inbox.finish(url.searchParams.get("id") || "");
    } catch (e) {
        const m = e && e.message ? e.message : "finish";
        const code = m === "missing" ? 404 : (m === "cancelled" || m === "incomplete" ? 409 : 400);
        text(res, code, m);
        return;
    }
    touch();
    noteSaved(saved);
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
}

function noteSaved(saved) {
    const shown = path.basename(saved.path);
    const clip = !!(saved.clip && saved.size > 0 && saved.size <= C.CLIPBOARD_IMAGE_MAX
        && FileNames.isImageName(shown));
    const note = clip ? "" : ("收到文件 " + shown);
    try {
        if (state.hooks.onFile) {
            state.hooks.onFile({ path: saved.path, name: shown, clip, size: saved.size, note });
        } else {
            console.log((note || "收到文件 " + shown) + " " + saved.path);
        }
    } catch (e) {
        console.log("webbridge file hook: " + e);
    }
}

function outList(req, res) {
    if (req.method !== "GET") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    touch();
    const plain = Buffer.from(outbox.listJson(), "utf8");
    writeSealed(res, plain, state.way === "A" ? "application/json; charset=utf-8" : "application/octet-stream");
}

function outChunk(req, res) {
    if (req.method !== "GET") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const index = Number(url.searchParams.get("i"));
    if (!Number.isInteger(index)) {
        text(res, 400, "index");
        return;
    }
    touch();
    let plain;
    try {
        plain = outbox.readChunk(url.searchParams.get("id"), index);
    } catch (e) {
        const m = e && e.message ? e.message : "chunk";
        text(res, m === "missing" ? 404 : 400, m);
        return;
    }
    writeSealed(res, plain, "application/octet-stream");
}

function outDrop(req, res) {
    if (req.method !== "POST") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const id = url.searchParams.get("id") || "";
    if (outbox.drop(id)) {
        publish({ v: 1, type: "file-gone", id });
    }
    touch();
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
}

function outClear(req, res) {
    if (req.method !== "POST") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    outbox.clear();
    publish({ v: 1, type: "file-clear" });
    touch();
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
}

function writeSealed(res, plain, plainType) {
    let body = plain;
    let type = plainType;
    if (state.way !== "A") {
        body = aes.seal(state.aesKey, plain);
        type = "application/octet-stream";
    }
    res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
}

function events(req, res) {
    if (req.method !== "GET") {
        text(res, 405, "method");
        return;
    }
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return;
    }
    if (state.clients.length >= MAX_CLIENTS) {
        text(res, 429, "busy");
        return;
    }
    const seen = state.sid;
    touch();
    res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
        "Referrer-Policy": "no-referrer",
        "X-Accel-Buffering": "no",
    });
    const client = new SseClient(req, res);
    if (!client.write(Buffer.from("retry: 2000\n\n", "utf8"))) {
        client.close();
        return;
    }
    if (!state.server || !hasSession() || seen !== state.sid) {
        client.close();
        return;
    }
    state.clients.push(client);
    for (const ev of state.outbound) {
        if (!client.write(ev)) {
            drop(client);
            return;
        }
    }
    req.on("close", () => drop(client));
}

function staticFile(req, res, name, type) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        text(res, 405, "method");
        return;
    }
    const file = path.join(staticRoot(), name);
    let body;
    try {
        body = fs.readFileSync(file);
    } catch (e) {
        text(res, 500, "missing page");
        return;
    }
    res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-cache",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
        res.end();
        return;
    }
    res.end(body);
}

async function openBody(req, res, max) {
    if (!sessionOk(req)) {
        text(res, 401, "session");
        return null;
    }
    if (tooLong(req, max)) {
        text(res, 413, "too big");
        return null;
    }
    const buf = await readBody(req, max);
    if (state.way === "A") {
        if (buf.length === 0 || buf.length > max) {
            text(res, buf.length > max ? 413 : 400, "body");
            return null;
        }
        return buf;
    }
    if (buf.length === 0 || buf.length > max) {
        text(res, buf.length > max ? 413 : 400, "body");
        return null;
    }
    try {
        return aes.open(state.aesKey, buf);
    } catch (e) {
        text(res, 400, "seal");
        return null;
    }
}

function sessionOk(req) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (!same(state.sid, url.searchParams.get("s"))) {
        return false;
    }
    if (state.way === "A") {
        let got = url.searchParams.get("t");
        if (!got) {
            const auth = req.headers.authorization || "";
            if (/^bearer\s+/i.test(auth)) {
                got = auth.replace(/^bearer\s+/i, "").trim();
            }
        }
        return same(state.token, got);
    }
    return state.aesKey != null;
}

function same(expect, got) {
    if (expect == null || got == null) {
        return false;
    }
    const a = Buffer.from(String(expect), "utf8");
    const b = Buffer.from(String(got), "utf8");
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

function touch() {
    if (hasSession()) {
        state.touched = Date.now();
    }
}

function tooLong(req, max) {
    const lenHdr = req.headers["content-length"];
    if (lenHdr == null || lenHdr === "") {
        return false;
    }
    const n = Number(lenHdr);
    return Number.isFinite(n) && n > max;
}

function readBody(req, max) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let settled = false;
        req.on("data", (c) => {
            if (settled) {
                return;
            }
            total += c.length;
            if (total > max) {
                settled = true;
                req.destroy();
                resolve(Buffer.alloc(max + 1));
                return;
            }
            chunks.push(c);
        });
        req.on("end", () => {
            if (!settled) {
                settled = true;
                resolve(Buffer.concat(chunks));
            }
        });
        req.on("error", (e) => {
            if (!settled) {
                settled = true;
                reject(e);
            }
        });
    });
}

function text(res, code, body) {
    const b = Buffer.from(String(body), "utf8");
    res.writeHead(code, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
    });
    res.end(b);
}

function drop(client) {
    const i = state.clients.indexOf(client);
    if (i >= 0) {
        state.clients.splice(i, 1);
    }
    client.close();
}

class SseClient {
    constructor(req, res) {
        this.req = req;
        this.res = res;
        this.host = remoteHost(req);
        this.closed = false;
    }

    write(buf) {
        if (this.closed) {
            return false;
        }
        try {
            this.res.write(buf);
            return true;
        } catch (e) {
            this.closed = true;
            return false;
        }
    }

    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        try {
            this.res.end();
        } catch (e) {
            /* 对方已经断开 */
        }
    }
}

function remoteHost(req) {
    const raw = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
    return String(raw).replace(/^::ffff:/, "") || "未知";
}

module.exports = {
    DEFAULT_PORT,
    INFO,
    setHooks,
    isRunning,
    hasSession,
    way,
    port,
    listenerCount,
    listenerHosts,
    caPath,
    pageUrl,
    start,
    stop,
    refreshSession,
    pushText,
    pushFile,
};
