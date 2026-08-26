const msystem = require("./src/nodejs/system");
const qrcode = require("./src/nodejs/qrimg");
const server = require("./src/nodejs/server");
const client = require("./src/nodejs/client");
const profile = require("./src/nodejs/profile");
const fileQueue = require("./src/nodejs/fileQueue");
const TsUri = require("./src/nodejs/protocol/tsUri");
const fs = require("fs");
const path = require("path");

window.getIpAddr = function () {
    return msystem.getIpAddr();
};

window.startServer = function (port, maxConnections = 1) {
    const customEnabled = !!utools.dbStorage.getItem("textsend.customPinEnabled");
    const customPin = String(utools.dbStorage.getItem("textsend.customPin") || "");
    server.createTsServer(port, maxConnections, customEnabled, customPin);
};

window.stopServer = function () {
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
    return !!utools.dbStorage.getItem("textsend.autoStartServer");
};

window.setAutoStartServer = function (v) {
    utools.dbStorage.setItem("textsend.autoStartServer", !!v);
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
