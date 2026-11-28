"use strict";

const profile = require("./profile");
const protoClient = require("./protocol/client");
const fileQueue = require("./fileQueue");

function pasteIncoming(text) {
    try {
        if (typeof utools !== "undefined") {
            utools.copyText(text);
            utools.hideMainWindowTypeString(text);
        }
    } catch (e) {
        console.log("pasteIncoming: " + e);
    }
}

function connectFailMessage(err) {
    const code = err && err.code ? String(err.code) : "";
    const msg = err && err.message ? String(err.message) : String(err || "");
    if (code === "ECONNREFUSED" || /ECONNREFUSED/i.test(msg)) {
        return "无法连接至对端：连接被拒绝。请确认对端服务已启动，且地址与端口正确。";
    }
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
        return "无法解析对端主机地址，请检查连接串中的主机名或 IP。";
    }
    if (code === "ENETUNREACH" || code === "EHOSTUNREACH") {
        return "网络不可达。请确认本机与对端处于同一可达网段。";
    }
    if (code === "ETIMEDOUT" || /timeout/i.test(msg)) {
        return "连接超时。请确认对端在线，且网络与防火墙允许访问该端口。";
    }
    if (/handshake/i.test(msg)) {
        return "握手失败。请确认 PIN 或密钥正确，且两端版本兼容。";
    }
    if (/invalid|parse|uri|格式|连接串/i.test(msg)) {
        return "连接串无效。请使用 ts://主机/kPIN 格式，并确认端口与密钥完整。";
    }
    return msg ? ("客户端连接失败：" + msg) : "客户端连接失败。";
}

function createTsClient(raw) {
    disconnectServer();
    profile.startStatus = 0;
    profile.startError = "";
    protoClient.connect(raw, pasteIncoming, fileQueue.fileIo()).then((peer) => {
        profile.currentClient = peer;
        fileQueue.attachPeer(peer);
        profile.startStatus = 1;
        profile.startError = "";
        console.log("Log: client session ready");
    }).catch((e) => {
        console.log("Client error: " + e);
        profile.currentClient = null;
        profile.startError = connectFailMessage(e);
        profile.startStatus = 2;
    });
}

function disconnectServer() {
    if (profile.currentClient) {
        try {
            profile.currentClient.close();
        } catch (e) {
            console.log("disconnectServer: " + e);
        }
        profile.currentClient = null;
    }
    profile.startStatus = -1;
    profile.clearText = false;
}

async function csend(msgString) {
    const p = profile.currentClient;
    if (!p || !p.isAlive()) {
        return;
    }
    await p.sendText(msgString);
    profile.clearText = true;
}

module.exports = {
    createTsClient,
    disconnectServer,
    csend,
};
