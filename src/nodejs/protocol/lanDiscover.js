/**
 * 局域网 UDP 探测。默认关。
 * 包格式（三端一致）：TSD1 | version=1 | tcpPort uint16 BE | nameLen | name | 8 字节实例号。
 * 只广播正在监听的 TCP 端口和设备名，不带 PIN / 密钥。
 * 探测口默认 54300（和 TCP 连接同一端口号，协议仍是 UDP），可改；绑不上时 bindError 带占用提示。
 * 「有连接时关闭」打开后，已经有会话就停广播、停监听。
 */
const dgram = require("dgram");
const os = require("os");
const crypto = require("crypto");
const lanAuth = require("./lanAuth");

const DEFAULT_PORT = 54300;
const MAGIC = Buffer.from("TSD1");
const VERSION = 1;
const NAME_MAX = 48;
const INTERVAL_MS = 1000;
// 超过这个时间没再收到广播就从列表去掉。强杀来不及发下线包，只能靠超时。
const PEER_TTL_MS = 2500;

const instanceId = crypto.randomBytes(8);
const peers = new Map();
let sock = null;
let timer = null;
let boundPort = -1;
let bindError = "";
/** @type {null | ((req: object) => void)} */
let onAuthRequest = null;
let onAuthCancel = null;
const QUERY = Buffer.from([0x54, 0x53, 0x51, 0x31, 1, 0]);

let state = {
    enabled: false,
    pauseWhenConnected: true,
    announce: true,
    connected: false,
    advertisePort: 0,
    udpPort: DEFAULT_PORT,
    name: "",
};

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

function encode(tcpPort, name, id) {
    const nameBytes = clipName(name);
    const out = Buffer.alloc(16 + nameBytes.length);
    MAGIC.copy(out, 0);
    out[4] = VERSION;
    out.writeUInt16BE(tcpPort, 5);
    out[7] = nameBytes.length;
    nameBytes.copy(out, 8);
    id.copy(out, 8 + nameBytes.length, 0, 8);
    return out;
}

function decode(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 16) {
        return null;
    }
    if (buf[0] !== 0x54 || buf[1] !== 0x53 || buf[2] !== 0x44 || buf[3] !== 0x31 || buf[4] !== VERSION) {
        return null;
    }
    const tcpPort = buf.readUInt16BE(5);
    const nameLen = buf[7];
    if (tcpPort < 1 || tcpPort > 65535 || nameLen > NAME_MAX || buf.length !== 16 + nameLen) {
        return null;
    }
    return {
        tcpPort,
        name: buf.subarray(8, 8 + nameLen).toString("utf8"),
        id: buf.subarray(8 + nameLen, 16 + nameLen),
    };
}

function ipv4Broadcast(ip, mask) {
    const a = String(ip || "").split(".").map((n) => Number(n));
    const m = String(mask || "").split(".").map((n) => Number(n));
    if (a.length !== 4 || m.length !== 4 || a.some((n) => !Number.isFinite(n)) || m.some((n) => !Number.isFinite(n))) {
        return null;
    }
    return a.map((o, i) => (o & m[i]) | ((~m[i]) & 255)).join(".");
}

function broadcastAddrs() {
    const out = ["255.255.255.255"];
    const ifs = os.networkInterfaces();
    for (const list of Object.values(ifs)) {
        for (const inf of list || []) {
            const v4 = inf.family === "IPv4" || inf.family === 4;
            if (!v4 || inf.internal) {
                continue;
            }
            const b = ipv4Broadcast(inf.address, inf.netmask);
            if (b) {
                out.push(b);
            }
        }
    }
    return [...new Set(out)];
}

function deviceName() {
    const raw = String(state.name || os.hostname() || "PC").replace(/[\u0000-\u001f]/g, "").trim();
    return raw || "PC";
}

function udpPort() {
    const n = Number(state.udpPort);
    return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : DEFAULT_PORT;
}

function listening() {
    return !!state.enabled;
}

/** 有连接且勾了暂停：停广播、不显示设备，套接字留着收授权。 */
function broadcasting() {
    return listening() && !(state.pauseWhenConnected && state.connected);
}

function listPeers() {
    if (!broadcasting() || bindError) {
        return [];
    }
    const now = Date.now();
    const out = [];
    for (const [key, seen] of peers) {
        if (now - seen.seenAt > PEER_TTL_MS) {
            peers.delete(key);
            continue;
        }
        out.push(seen.peer);
    }
    out.sort((a, b) => (a.name || a.host).localeCompare(b.name || b.host));
    return out;
}

function isQuery(buf) {
    return Buffer.isBuffer(buf) && buf.length >= 6
        && buf[0] === 0x54 && buf[1] === 0x53 && buf[2] === 0x51 && buf[3] === 0x31
        && buf[4] === 1;
}

function sendProbe() {
    if (!sock || !broadcasting() || bindError) {
        return;
    }
    const disco = udpPort();
    for (const addr of broadcastAddrs()) {
        try {
            sock.send(QUERY, disco, addr);
        } catch (_e) {
        }
    }
}

function replyQuery(rinfo) {
    if (!sock || !rinfo) {
        return;
    }
    const port = Number(state.advertisePort);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
        return;
    }
    try {
        sock.send(encode(port, deviceName(), instanceId), rinfo.port, rinfo.address);
    } catch (_e) {
    }
}

function sendBeacon() {
    if (!sock || !broadcasting() || !state.announce || bindError) {
        return;
    }
    const port = Number(state.advertisePort);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
        return;
    }
    const packet = encode(port, deviceName(), instanceId);
    const disco = udpPort();
    for (const addr of broadcastAddrs()) {
        try {
            sock.send(packet, disco, addr);
        } catch (_e) {
        }
    }
}

function onMessage(msg, rinfo) {
    if (!rinfo || rinfo.family === "IPv6" || rinfo.address === "0.0.0.0" || rinfo.address === "127.0.0.1") {
        return;
    }
    if (isQuery(msg)) {
        replyQuery(rinfo);
        return;
    }
    if (lanAuth.isAuthPacket(msg)) {
        const type = lanAuth.typeOf(msg);
        if (type === lanAuth.TYPE_GRANT || type === lanAuth.TYPE_DENY || type === lanAuth.TYPE_PENDING) {
            lanAuth.onAuthReply(msg);
            return;
        }
        if (type === lanAuth.TYPE_REQUEST) {
            const req = lanAuth.parseRequest(msg, rinfo.address, rinfo.port);
            if (req && typeof onAuthRequest === "function") {
                onAuthRequest(req);
            }
            return;
        }
        if (type === lanAuth.TYPE_CANCEL) {
            const nonce = lanAuth.cancelNonce(msg);
            if (nonce && typeof onAuthCancel === "function") {
                onAuthCancel(rinfo.address, nonce);
            }
            return;
        }
        return;
    }
    if (!broadcasting()) {
        return;
    }
    const decoded = decode(msg);
    if (!decoded || decoded.id.equals(instanceId)) {
        return;
    }
    const idKey = Buffer.isBuffer(decoded.id) ? decoded.id.toString("hex") : "";
    const peer = { host: rinfo.address, tcpPort: decoded.tcpPort, name: decoded.name, idKey };
    // 同实例多网卡：两条都留，UI 用 idKey 提示可能是同一设备
    peers.set(peer.host + ":" + peer.tcpPort, { peer, seenAt: Date.now() });
}

function setAuthRequestHandler(fn) {
    onAuthRequest = typeof fn === "function" ? fn : null;
}

function setAuthCancelHandler(fn) {
    onAuthCancel = typeof fn === "function" ? fn : null;
}

function sendAuthPacket(host, port, buf) {
    if (!sock || !host || !Buffer.isBuffer(buf)) {
        return false;
    }
    const p = Number(port);
    if (!Number.isFinite(p) || p < 1 || p > 65535) {
        return false;
    }
    try {
        sock.send(buf, p, String(host));
        return true;
    } catch (_e) {
        return false;
    }
}

function requestAuth(host, udpPort, onSas) {
    if (!sock) {
        return Promise.reject(new Error("请先打开局域网探测"));
    }
    return lanAuth.requestAuth(sock, host, udpPort, deviceName(), onSas);
}

function requestAuthTcp(host, tcpPort, onSas) {
    return lanAuth.requestAuthTcp(host, tcpPort, deviceName(), onSas);
}

function bindTip(port, err) {
    const code = err && err.code;
    const msg = err && err.message ? String(err.message) : "";
    if (code === "EADDRINUSE" || /address already in use/i.test(msg)) {
        return "探测端口 " + port + " 已被占用";
    }
    return "探测端口 " + port + " 打不开";
}

function ensureLoop() {
    const disco = udpPort();
    if (sock && boundPort === disco) {
        return;
    }
    stopLoop(false);
    const created = dgram.createSocket({ type: "udp4", reuseAddr: true });
    created.on("error", (err) => {
        if (sock !== created) {
            return;
        }
        bindError = bindTip(disco, err);
        stopLoop(false);
        if (listening()) {
            setTimeout(ensureLoop, 1500);
        }
    });
    created.on("message", onMessage);
    created.bind(disco, () => {
        try {
            created.setBroadcast(true);
        } catch (_e) {
        }
        bindError = "";
        boundPort = disco;
    });
    sock = created;
    timer = setInterval(() => {
        if (!broadcasting()) {
            peers.clear();
            return;
        }
        sendBeacon();
        sendProbe();
    }, INTERVAL_MS);
    sendBeacon();
    sendProbe();
}

function stopLoop(clearError = true) {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    if (sock) {
        const current = sock;
        sock = null;
        try {
            current.close();
        } catch (_e) {
        }
    }
    boundPort = -1;
    peers.clear();
    if (clearError) {
        bindError = "";
    }
}

function sync(next) {
    const nextPort = Number(next && next.udpPort);
    state = {
        enabled: !!(next && next.enabled),
        pauseWhenConnected: !!(next && next.pauseWhenConnected),
        announce: !(next && next.announce === false),
        connected: !!(next && next.connected),
        advertisePort: Number(next && next.advertisePort) || 0,
        udpPort: Number.isFinite(nextPort) && nextPort >= 1 && nextPort <= 65535 ? nextPort : DEFAULT_PORT,
        name: next && next.name ? String(next.name) : state.name,
    };
    const paused = !!state.enabled && !!state.pauseWhenConnected && !!state.connected;
    if (listening()) {
        ensureLoop();
    } else {
        stopLoop(true);
    }
    return {
        paused,
        peers: listPeers(),
        bindError: listening() ? bindError : "",
        udpPort: udpPort(),
    };
}

function stop() {
    stopLoop(true);
}

module.exports = {
    DEFAULT_PORT,
    encode,
    decode,
    sync,
    listPeers,
    stop,
    setAuthRequestHandler,
    setAuthCancelHandler,
    sendAuthPacket,
    requestAuth,
    requestAuthTcp,
};

if (require.main === module) {
    const id = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const pkt = encode(54300, "pc", id);
    const hex = pkt.toString("hex");
    const expect = "5453443101d41c0270630102030405060708";
    if (hex !== expect) {
        console.error(hex);
        process.exit(1);
    }
    const decoded = decode(pkt);
    if (!decoded || decoded.tcpPort !== 54300 || decoded.name !== "pc" || !decoded.id.equals(id)) {
        process.exit(1);
    }
    console.log("ok");
}
