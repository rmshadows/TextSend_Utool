const msystem = require("./src/nodejs/system");
const qrcode = require("./src/nodejs/qrimg");
const server = require("./src/nodejs/server");
const client = require("./src/nodejs/client");
const profile = require("./src/nodejs/profile");
const TsUri = require("./src/nodejs/protocol/tsUri");
const net = require("net");

window.getIpAddr = function () {
    return msystem.getIpAddr();
};

window.startServer = function (port, maxConnections = 1) {
    server.createTsServer(port, maxConnections);
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

window.isIPv6 = function (ip) {
    if (String(ip).indexOf("]:") !== -1) {
        return true;
    }
    return net.isIPv6(ip);
};

window.getTempDir = function () {
    return utools.getPath("temp");
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

window.getUiZoom = function () {
    const v = utools.dbStorage.getItem("textsend.zoom");
    return v == null ? 100 : Number(v);
};

window.setUiZoom = function (n) {
    utools.dbStorage.setItem("textsend.zoom", n);
};

window.showPath = function () {
    console.log("用户的 home 文件夹（主目录）: " + utools.getPath("home"));
};
