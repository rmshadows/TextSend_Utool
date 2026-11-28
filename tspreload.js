const msystem = require("./src/nodejs/system");
const qrcode = require("./src/nodejs/qrimg");
const server = require("./src/nodejs/server");
const client = require("./src/nodejs/client");
const profile = require("./src/nodejs/profile");
const fileQueue = require("./src/nodejs/fileQueue");
const TsUri = require("./src/nodejs/protocol/tsUri");
const lanDiscover = require("./src/nodejs/protocol/lanDiscover");
const lanAuthGate = require("./src/nodejs/protocol/lanAuthGate");
const webBridge = require("./src/nodejs/webbridge/server");
const sendPrefs = require("./src/nodejs/sendPrefs");
const FileNames = require("./src/nodejs/protocol/fileNames");
const ProtocolC = require("./src/nodejs/protocol/constants");
const os = require("os");
const fs = require("fs");
const path = require("path");

/** dbStorage 布尔：用 1 / 删除，避免 false 读出来异常 */
function storageFlagGet(key) {
    const v = utools.dbStorage.getItem(key);
    return v === true || v === 1 || v === "1" || v === "true";
}

function storageFlagSet(key, on) {
    if (on) {
        utools.dbStorage.setItem(key, 1);
    } else {
        utools.dbStorage.removeItem(key);
    }
}

function readAuthBlacklist() {
    const raw = utools.dbStorage.getItem("textsend.authBlacklist");
    if (raw == null || raw === "") {
        return [];
    }
    return String(raw).split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function writeAuthBlacklist(list) {
    const uniq = [...new Set((list || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
    utools.dbStorage.setItem("textsend.authBlacklist", uniq.join(","));
    return uniq;
}

function syncAuthGateConfig() {
    const rate = Number(utools.dbStorage.getItem("textsend.authRatePerMin"));
    const coolRaw = utools.dbStorage.getItem("textsend.authCooldownSec");
    const cool = coolRaw == null ? 10 : Number(coolRaw);
    lanAuthGate.setConfig({
        ratePerMin: Number.isFinite(rate) && rate >= 1 && rate <= 60 ? rate : 3,
        cooldownSec: Number.isFinite(cool) && cool >= 0 && cool <= 86400 ? cool : 10,
        blacklist: readAuthBlacklist(),
    });
}

lanAuthGate.boot();

window.getIpAddr = function () {
    return msystem.getIpAddr();
};

window.startServer = function (port, maxConnections = 1) {
    if (sendPrefs.getWebAppExclusive() && webBridge.isRunning()) {
        webBridge.stop();
    }
    const customEnabled = !!utools.dbStorage.getItem("textsend.customPinEnabled");
    const customPin = String(utools.dbStorage.getItem("textsend.customPin") || "");
    server.createTsServer(port, maxConnections, customEnabled, customPin);
};

window.stopServer = function () {
    lanAuthGate.clearPending(true);
    server.closeAllServers();
};

window.startClient = function (raw) {
    client.createTsClient(raw);
};

window.stopClient = function () {
    client.disconnectServer();
};

window.serverSend = function (msgString) {
    return server.ssend(msgString);
};

window.clientSend = function (msgString) {
    return client.csend(msgString);
};

window.getQrImgPath = function (content) {
    return qrcode.generateQR(content, utools.getPath("temp"));
};

/** 下载链接等小二维码（侧栏连接码仍用 getQrImgPath 512） */
const linkQrCache = Object.create(null);
window.getLinkQrImgPath = function (content) {
    const key = String(content || "");
    if (linkQrCache[key]) {
        return linkQrCache[key];
    }
    const fp = qrcode.generateQR(key, utools.getPath("temp"), 120);
    if (fp && !String(fp).includes("favicon")) {
        linkQrCache[key] = fp;
    }
    return fp;
};

window.getConnectionStat = function () {
    return [profile.serverCount(), profile.readyCount()];
};

window.getMsgFeedbackStat = function () {
    return profile.clearText;
};

window.setClearStat = function (value) {
    if (profile.clearText !== value) {
        profile.clearText = value;
    }
};

window.startSuccessful = function () {
    return profile.startStatus;
};

window.setStartStatus = function (value) {
    profile.startStatus = value;
};

window.getStartError = function () {
    return String(profile.startError || "");
};

window.getPin = function () {
    const s = profile.currentServer;
    return s && s.material ? s.material.pin : "";
};

window.getPskB64 = function () {
    const s = profile.currentServer;
    return s && s.material ? s.material.pskB64 : "";
};

window.formatUri = function (host, port, k) {
    return TsUri.format(host, port, k);
};

window.copyText = function (text) {
    if (text) {
        utools.copyText(String(text));
    }
};

window.openExternalUrl = function (url) {
    const u = String(url || "").trim();
    if (!u) {
        return;
    }
    if (typeof utools.shellOpenExternal === "function") {
        utools.shellOpenExternal(u);
    }
};

window.getUiZoom = function () {
    const v = utools.dbStorage.getItem("textsend.zoom");
    return v == null ? 100 : Number(v);
};

window.setUiZoom = function (n) {
    utools.dbStorage.setItem("textsend.zoom", n);
};

window.getAutoStartServer = function () {
    return storageFlagGet("textsend.autoStartServer");
};

window.setAutoStartServer = function (v) {
    storageFlagSet("textsend.autoStartServer", !!v);
};

window.getListenIp = function () {
    const v = utools.dbStorage.getItem("textsend.listenIp");
    return v == null ? "" : String(v);
};

window.setListenIp = function (ip) {
    if (ip != null && String(ip).trim()) {
        utools.dbStorage.setItem("textsend.listenIp", String(ip).trim());
    }
};

window.getListenPort = function () {
    const v = utools.dbStorage.getItem("textsend.listenPort");
    if (v == null) {
        return 54300;
    }
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : 54300;
};

window.setListenPort = function (port) {
    const n = Number(port);
    if (Number.isFinite(n) && n >= 1 && n <= 65535) {
        utools.dbStorage.setItem("textsend.listenPort", n);
        if (window.getLanDiscoverPortFollow()) {
            utools.dbStorage.setItem("textsend.lanDiscoverPort", n);
        }
    }
};

window.getCustomPinEnabled = function () {
    return !!utools.dbStorage.getItem("textsend.customPinEnabled");
};

window.setCustomPinEnabled = function (v) {
    utools.dbStorage.setItem("textsend.customPinEnabled", !!v);
};

window.getCustomPin = function () {
    const v = utools.dbStorage.getItem("textsend.customPin");
    return v == null ? "" : String(v);
};

window.setCustomPin = function (pin) {
    const s = String(pin || "").trim();
    if (s && !/^\d{8}$/.test(s)) {
        return false;
    }
    utools.dbStorage.setItem("textsend.customPin", s);
    return true;
};

window.getLanDiscover = function () {
    return storageFlagGet("textsend.lanDiscover");
};

window.setLanDiscover = function (v) {
    storageFlagSet("textsend.lanDiscover", !!v);
    // 关掉时立刻停 UDP，不等下一次 sync
    if (!v) {
        lanDiscover.stop();
        lanAuthGate.clearPending(true);
    }
};

window.getLanDiscoverPause = function () {
    const v = utools.dbStorage.getItem("textsend.lanDiscoverPause");
    // 没存过就是开。关掉会写成 0，不能删键，否则和「从没设置」分不开。
    if (v == null) {
        return true;
    }
    return v === true || v === 1 || v === "1" || v === "true";
};

window.setLanDiscoverPause = function (v) {
    utools.dbStorage.setItem("textsend.lanDiscoverPause", v ? 1 : 0);
};

function flagDefaultOn(key) {
    const v = utools.dbStorage.getItem(key);
    if (v == null) {
        return true;
    }
    return v === true || v === 1 || v === "1" || v === "true";
}

window.getLanDiscoverAnnounce = function () {
    return flagDefaultOn("textsend.lanDiscoverAnnounce");
};

window.setLanDiscoverAnnounce = function (v) {
    utools.dbStorage.setItem("textsend.lanDiscoverAnnounce", v ? 1 : 0);
};

window.getLanDiscoverPortFollow = function () {
    return flagDefaultOn("textsend.lanDiscoverPortFollow");
};

window.setLanDiscoverPortFollow = function (v) {
    utools.dbStorage.setItem("textsend.lanDiscoverPortFollow", v ? 1 : 0);
    if (v) {
        utools.dbStorage.setItem("textsend.lanDiscoverPort", window.getListenPort());
    }
};

window.getLanDiscoverPort = function () {
    if (window.getLanDiscoverPortFollow()) {
        return window.getListenPort();
    }
    const v = utools.dbStorage.getItem("textsend.lanDiscoverPort");
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1 && n <= 65535) {
        return n === 54301 ? 54300 : n;
    }
    return 54300;
};

window.setLanDiscoverPort = function (port) {
    if (window.getLanDiscoverPortFollow()) {
        return true;
    }
    const n = Number(port);
    if (!Number.isFinite(n) || n < 1 || n > 65535) {
        return false;
    }
    utools.dbStorage.setItem("textsend.lanDiscoverPort", n);
    return true;
};

window.stopLanDiscover = function () {
    lanDiscover.stop();
};

window.syncLanDiscover = function (live) {
    const connected = !!(live && (live.connected || live.connectedCount > 0));
    const advertisePort = Number(live && live.advertisePort) || 0;
    syncAuthGateConfig();
    const enabled = window.getLanDiscover();
    if (!enabled) {
        lanDiscover.stop();
        return {
            paused: false,
            peers: [],
            bindError: "",
            udpPort: window.getLanDiscoverPort(),
        };
    }
    return lanDiscover.sync({
        enabled: true,
        pauseWhenConnected: window.getLanDiscoverPause(),
        announce: window.getLanDiscoverAnnounce(),
        connected,
        advertisePort,
        udpPort: window.getLanDiscoverPort(),
        name: os.hostname() || "PC",
    });
};

window.resetTextsendSettings = function () {
    utools.dbStorage.removeItem("textsend.autoStartServer");
    utools.dbStorage.removeItem("textsend.customPinEnabled");
    utools.dbStorage.setItem("textsend.customPin", "");
    utools.dbStorage.removeItem("textsend.rememberClientConnection");
    utools.dbStorage.removeItem("textsend.clientHost");
    utools.dbStorage.removeItem("textsend.clientPort");
    utools.dbStorage.removeItem("textsend.clientPin");
    utools.dbStorage.removeItem("textsend.lanDiscover");
    utools.dbStorage.setItem("textsend.lanDiscoverPause", 1);
    utools.dbStorage.setItem("textsend.lanDiscoverAnnounce", 1);
    utools.dbStorage.setItem("textsend.lanDiscoverPort", 54300);
    utools.dbStorage.setItem("textsend.lanDiscoverPortFollow", 1);
    utools.dbStorage.setItem("textsend.maxClients", 7);
    utools.dbStorage.setItem("textsend.authRatePerMin", 3);
    utools.dbStorage.setItem("textsend.authCooldownSec", 10);
    utools.dbStorage.setItem("textsend.authBlacklist", "");
    utools.dbStorage.setItem("textsend.listenPort", 54300);
    utools.dbStorage.removeItem("textsend.listenIp");
    sendPrefs.resetDefaults();
    lanDiscover.stop();
    lanAuthGate.clearPending(true);
    syncAuthGateConfig();
};

/** 设置保存后立刻套用探测 / 授权门控；可选热更新当前服务端人数上限 */
window.applyLanSettingsNow = function (live) {
    syncAuthGateConfig();
    const snap = window.syncLanDiscover(live || {});
    const maxN = window.getMaxClients();
    const s = profile.currentServer;
    if (s && s.running && Number.isFinite(maxN) && maxN >= 1) {
        s.maxConnections = maxN;
    }
    return snap;
};

window.getMaxClients = function () {
    const n = Number(utools.dbStorage.getItem("textsend.maxClients"));
    return Number.isFinite(n) && n >= 1 && n <= 64 ? n : 7;
};

window.setMaxClients = function (n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 1 || v > 64) {
        return false;
    }
    utools.dbStorage.setItem("textsend.maxClients", v);
    return true;
};

window.getAuthRatePerMin = function () {
    const n = Number(utools.dbStorage.getItem("textsend.authRatePerMin"));
    return Number.isFinite(n) && n >= 1 && n <= 60 ? n : 3;
};

window.setAuthRatePerMin = function (n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 1 || v > 60) {
        return false;
    }
    utools.dbStorage.setItem("textsend.authRatePerMin", v);
    syncAuthGateConfig();
    return true;
};

window.getAuthCooldownSec = function () {
    const n = Number(utools.dbStorage.getItem("textsend.authCooldownSec"));
    if (n === 0) {
        return 0;
    }
    return Number.isFinite(n) && n >= 0 && n <= 86400 ? n : 10;
};

window.setAuthCooldownSec = function (n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0 || v > 86400) {
        return false;
    }
    utools.dbStorage.setItem("textsend.authCooldownSec", v);
    syncAuthGateConfig();
    return true;
};

window.getAuthBlacklistText = function () {
    return readAuthBlacklist().join("\n");
};

window.setAuthBlacklistText = function (text) {
    const list = String(text || "").split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    writeAuthBlacklist(list);
    syncAuthGateConfig();
};

window.getSendTargetIndex = function () {
    return sendPrefs.getSendTargetIndex();
};

window.setSendTargetIndex = function (index) {
    return sendPrefs.setSendTargetIndex(index);
};

window.getWebAppExclusive = function () {
    return sendPrefs.getWebAppExclusive();
};

window.setWebAppExclusive = function (on) {
    sendPrefs.setWebAppExclusive(!!on);
};

window.getWebBlacklistText = function () {
    return sendPrefs.getWebBlacklistText();
};

window.setWebBlacklistText = function (text) {
    sendPrefs.setWebBlacklistText(text);
    webBridge.dropBlacklisted();
};

window.addWebBlacklist = function (host) {
    const h = String(host || "").trim().toLowerCase().replace(/^::ffff:/, "");
    if (!h) {
        return false;
    }
    const list = sendPrefs.readWebBlacklist();
    if (list.includes(h)) {
        webBridge.dropBlacklisted();
        return false;
    }
    list.push(h);
    sendPrefs.writeWebBlacklist(list);
    webBridge.dropBlacklisted();
    return true;
};

window.routeSend = function () {
    return sendPrefs.routeSend();
};

syncAuthGateConfig();

window.listLanAuthPending = function () {
    if (!window.getLanDiscover() || !profile.currentServer) {
        lanAuthGate.clearPending(true);
        return [];
    }
    return lanAuthGate.listPending();
};

window.decideLanAuth = function (host, action) {
    const r = lanAuthGate.decide(host, action);
    if (r && r.action === "blacklist" && Array.isArray(r.blacklist)) {
        writeAuthBlacklist(r.blacklist);
        syncAuthGateConfig();
    }
    return r;
};

window.denyAllLanAuth = function () {
    return lanAuthGate.denyAll();
};

window.listAliveClients = function () {
    const s = profile.currentServer;
    return s && typeof s.listAliveClients === "function" ? s.listAliveClients() : [];
};

window.kickClientHost = function (host) {
    const s = profile.currentServer;
    return !!(s && s.kickHost(host));
};

window.kickAllClients = function () {
    const s = profile.currentServer;
    if (!s) {
        return 0;
    }
    let n = 0;
    for (const c of s.listAliveClients()) {
        if (s.kickHost(c.host)) {
            n++;
        }
    }
    return n;
};

/** 客户端点设备：先走 TCP 敲门，UDP 只作备用。拒绝和冷却不再改走 UDP。 */
window.cancelLanAuth = function () {
    const lanAuth = require("./src/nodejs/protocol/lanAuth");
    return lanAuth.cancelActive();
};

window.lanAuthWaiting = function (host) {
    const lanAuth = require("./src/nodejs/protocol/lanAuth");
    return lanAuth.isWaiting(host);
};

window.requestLanAuthConnect = async function (host, tcpPort, onSas) {
    const lanAuth = require("./src/nodejs/protocol/lanAuth");
    const port = Number(tcpPort) >= 1 && Number(tcpPort) <= 65535 ? Number(tcpPort) : 54300;
    const sasCb = typeof onSas === "function" ? onSas : null;
    let grant;
    try {
        grant = await lanDiscover.requestAuthTcp(host, port, sasCb);
    } catch (e) {
        if (lanAuth.isDenied(e) || lanAuth.isCancelled(e)) {
            throw e;
        }
        grant = await lanDiscover.requestAuth(host, window.getLanDiscoverPort(), sasCb);
    }
    const usePort = grant.tcpPort > 0 ? grant.tcpPort : port;
    return TsUri.format(String(host || ""), usePort, grant.pskB64);
};

window.getRememberClientConnection = function () {
    return !!utools.dbStorage.getItem("textsend.rememberClientConnection");
};

window.setRememberClientConnection = function (v) {
    utools.dbStorage.setItem("textsend.rememberClientConnection", !!v);
    if (!v) {
        utools.dbStorage.removeItem("textsend.clientHost");
        utools.dbStorage.removeItem("textsend.clientPort");
        utools.dbStorage.removeItem("textsend.clientPin");
    }
};

window.getClientHost = function () {
    const v = utools.dbStorage.getItem("textsend.clientHost");
    return v == null ? "" : String(v).trim();
};

window.getClientPort = function () {
    const v = utools.dbStorage.getItem("textsend.clientPort");
    if (v == null) {
        return 54300;
    }
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : 54300;
};

window.getClientPin = function () {
    const v = utools.dbStorage.getItem("textsend.clientPin");
    const s = v == null ? "" : String(v).trim();
    return /^\d{8}$/.test(s) ? s : "";
};

window.trySaveClientConnection = function (raw) {
    if (!utools.dbStorage.getItem("textsend.rememberClientConnection")) {
        return;
    }
    try {
        const uri = TsUri.parse(String(raw || "").trim());
        if (!uri.pinMode) {
            return;
        }
        utools.dbStorage.setItem("textsend.clientHost", uri.host);
        utools.dbStorage.setItem("textsend.clientPort", uri.port);
        utools.dbStorage.setItem("textsend.clientPin", uri.k);
    } catch (e) {
        /* ignore bad uri */
    }
};

window.formatSavedClientRaw = function () {
    const host = window.getClientHost();
    const pin = window.getClientPin();
    if (!host || !pin) {
        return "";
    }
    try {
        return TsUri.format(host, window.getClientPort(), pin);
    } catch (e) {
        return "";
    }
};

window.pickAndAddFiles = async function () {
    const paths = await fileQueue.pickFiles();
    return fileQueue.addFiles(paths);
};

window.pickAndAddFolders = async function () {
    const paths = await fileQueue.pickFolders();
    return fileQueue.addFolders(paths);
};

window.getPathForDroppedFile = function (file) {
    if (!file) {
        return "";
    }
    try {
        const { webUtils } = require("electron");
        if (webUtils && typeof webUtils.getPathForFile === "function") {
            const p = webUtils.getPathForFile(file);
            if (p) {
                return p;
            }
        }
    } catch (e) {
        /* 旧 Electron 没有 webUtils */
    }
    return file.path || "";
};

window.addDroppedPaths = function (paths) {
    return fileQueue.addDropped(paths);
};

window.removeQueued = function (ids) {
    return fileQueue.removeIds(ids);
};

window.clearFileQueue = function () {
    return fileQueue.clearQueue();
};

window.sendFileQueue = function () {
    return fileQueue.sendLoop();
};

window.cancelFileTransfer = function () {
    fileQueue.cancelCurrent();
};

window.getFileStat = function () {
    return fileQueue.snapshot();
};

window.openInboxDir = function () {
    return fileQueue.openInbox();
};

webBridge.setHooks({
    onText(text) {
        console.log("webbridge text: " + text);
        try {
            if (typeof utools !== "undefined") {
                utools.copyText(String(text));
                if (typeof utools.hideMainWindowTypeString === "function") {
                    utools.hideMainWindowTypeString(String(text));
                }
                if (typeof utools.showNotification === "function") {
                    utools.showNotification("收到网页文字");
                }
            }
        } catch (e) {
            console.log("webbridge text hook: " + e);
        }
    },
    onFile(info) {
        let note = info && info.note ? info.note : ("收到文件 " + (info && info.name ? info.name : ""));
        if (info && info.clip && info.path && info.size > 0 && info.size <= ProtocolC.CLIPBOARD_IMAGE_MAX
            && FileNames.isImageName(info.name)) {
            try {
                const { clipboard, nativeImage } = require("electron");
                const img = nativeImage.createFromPath(info.path);
                if (img && !img.isEmpty()) {
                    clipboard.writeImage(img);
                    note = "收到图片 " + info.name + "，已放入剪贴板";
                }
            } catch (e) {
                note = "收到文件 " + info.name;
            }
        }
        console.log(note + (info && info.path ? " " + info.path : ""));
        try {
            if (typeof utools !== "undefined" && typeof utools.showNotification === "function") {
                utools.showNotification(note);
            }
        } catch (e) {
            /* 通知失败时控制台里还有一行 */
        }
    },
});

window.startWebBridge = function (port, way) {
    let stoppedApp = false;
    if (sendPrefs.getWebAppExclusive()) {
        const s = profile.currentServer;
        if (s && s.running) {
            window.stopServer();
            stoppedApp = true;
        }
    }
    return webBridge.start(port, way).then(() => ({ ok: true, stoppedApp })).catch((e) => ({
        ok: false,
        err: e && e.message ? e.message : String(e),
        stoppedApp,
    }));
};

window.stopWebBridge = function () {
    return webBridge.stop();
};

window.webBridgePageUrl = function (host) {
    return webBridge.pageUrl(host);
};

window.webBridgeRunning = function () {
    return webBridge.isRunning();
};

window.webBridgeHasSession = function () {
    return webBridge.hasSession();
};

window.webBridgeWay = function () {
    return webBridge.way();
};

window.webBridgePort = function () {
    return webBridge.port();
};

window.webBridgeListeners = function () {
    return webBridge.listenerHosts();
};

window.webBridgeDropListener = function (index, host) {
    return webBridge.dropListener(index, host);
};

window.webBridgeDropAllListeners = function () {
    webBridge.dropAllListeners();
};

window.webBridgeCaPath = function () {
    return webBridge.caPath();
};

window.webBridgeRevealCa = function () {
    const p = webBridge.caPath();
    if (!p) {
        return "";
    }
    try {
        if (typeof utools !== "undefined" && typeof utools.shellShowItemInFolder === "function") {
            utools.shellShowItemInFolder(p);
        } else if (typeof utools !== "undefined" && typeof utools.shellOpenPath === "function") {
            utools.shellOpenPath(path.dirname(p));
        }
    } catch (e) {
        console.log("webbridge ca: " + e);
    }
    return p;
};

window.refreshWebSession = function () {
    webBridge.refreshSession();
    return webBridge.pageUrl("127.0.0.1");
};

window.webPushText = function (text) {
    return webBridge.pushText(text);
};

window.readClipboardImage = function () {
    try {
        const { clipboard } = require("electron");
        const img = clipboard.readImage();
        if (img && !img.isEmpty()) {
            const png = img.toPNG();
            if (png && png.length) {
                const sz = img.getSize();
                const fp = path.join(utools.getPath("temp"), "textsend-paste-" + Date.now() + ".png");
                fs.writeFileSync(fp, png);
                let thumb = "";
                try {
                    thumb = "data:image/png;base64," + img.resize({ height: 64 }).toPNG().toString("base64");
                } catch (e) {
                    thumb = "";
                }
                return { path: fp, width: sz.width, height: sz.height, thumb: thumb };
            }
        }
    } catch (e) {
        console.log("readClipboardImage: " + e);
    }
    try {
        if (typeof utools.getCopyedFiles === "function") {
            const files = utools.getCopyedFiles() || [];
            for (const f of files) {
                if (!f || !f.isFile || !f.path) {
                    continue;
                }
                const n = String(f.name || f.path).toLowerCase();
                if (!/\.(png|jpe?g|gif|webp|bmp)$/.test(n) || !fs.existsSync(f.path)) {
                    continue;
                }
                let width = 0;
                let height = 0;
                let thumb = "";
                try {
                    const { nativeImage } = require("electron");
                    const img = nativeImage.createFromPath(f.path);
                    if (img && !img.isEmpty()) {
                        const sz = img.getSize();
                        width = sz.width;
                        height = sz.height;
                        thumb = "data:image/png;base64," + img.resize({ height: 64 }).toPNG().toString("base64");
                    }
                } catch (e) {
                    /* ignore */
                }
                return { path: f.path, width: width, height: height, thumb: thumb };
            }
        }
    } catch (e) {
        console.log("readClipboardImage files: " + e);
    }
    return null;
};

window.readImageDataUrl = function (filePath) {
    try {
        if (!filePath || !fs.existsSync(filePath)) {
            return "";
        }
        return "data:image/png;base64," + fs.readFileSync(filePath).toString("base64");
    } catch (e) {
        return "";
    }
};

window.sendPasteImage = function (filePath) {
    return fileQueue.sendOnePath(filePath);
};

/** uTools 搜索框粘贴 ts:// 后进入插件时暂存，供 UI 自动连接 */
let pendingTsUri = "";

function extractTsUri(text) {
    const raw = String(text || "").trim();
    if (!raw) {
        return "";
    }
    const candidates = [];
    const first = raw.split(/\r?\n/, 1)[0].trim();
    candidates.push(first);
    const embedded = raw.match(/ts:\/\/\S+/i);
    if (embedded) {
        candidates.push(embedded[0].replace(/[ sp]+$/i, "").replace(/[),.;]+$/, ""));
    }
    const bare = raw.match(/(?:^|\s)((?:\[[^\]]+\]|[A-Za-z0-9._-]+)(?::\d{1,5})?\/k\S+)/);
    if (bare) {
        candidates.push(bare[1]);
    }
    for (const c of candidates) {
        let s = String(c || "").trim();
        if (!s) {
            continue;
        }
        if (!/^ts:\/\//i.test(s)) {
            s = "ts://" + s.replace(/^ts:\/\//i, "");
        }
        try {
            TsUri.parse(s);
            return s;
        } catch (_e) {
            /* try next */
        }
    }
    return "";
}

function notifyPendingTsUri(uri) {
    try {
        if (typeof window.dispatchEvent === "function") {
            window.dispatchEvent(new CustomEvent("textsend-pending-uri", { detail: uri }));
        }
    } catch (_e) {
    }
}

window.consumePendingTsUri = function () {
    const u = pendingTsUri;
    pendingTsUri = "";
    return u;
};

window.peekPendingTsUri = function () {
    return pendingTsUri;
};

if (typeof utools !== "undefined" && typeof utools.onPluginEnter === "function") {
    utools.onPluginEnter(({ type, payload }) => {
        if (type !== "regex" && type !== "over" && type !== "text") {
            return;
        }
        // text 指令进入时 payload 是指令名，不是连接串
        if (type === "text") {
            return;
        }
        const uri = extractTsUri(payload);
        if (!uri) {
            return;
        }
        pendingTsUri = uri;
        notifyPendingTsUri(uri);
    });
}
