"use strict";

/**
 * 发送目标与兼容互斥。和电脑端 UserConfig.sendTarget / webAppExclusive 对齐。
 * 只在 uTools preload 里用（依赖 utools.dbStorage）。
 */
const profile = require("./profile");
const webBridge = require("./webbridge/server");

function getSendTarget() {
    const v = utools.dbStorage.getItem("textsend.sendTarget");
    if (v === "web" || v === "app" || v === "all") {
        return v;
    }
    return "all";
}

function setSendTarget(v) {
    const next = v === "web" || v === "app" || v === "all" ? v : "all";
    utools.dbStorage.setItem("textsend.sendTarget", next);
    return next;
}

function getSendTargetIndex() {
    const t = getSendTarget();
    if (t === "web") {
        return 1;
    }
    if (t === "all") {
        return 2;
    }
    return 0;
}

function setSendTargetIndex(index) {
    return setSendTarget(index === 1 ? "web" : (index === 2 ? "all" : "app"));
}

function getWebAppExclusive() {
    const v = utools.dbStorage.getItem("textsend.webAppExclusive");
    return v === true || v === 1 || v === "1" || v === "true";
}

function setWebAppExclusive(on) {
    if (on) {
        utools.dbStorage.setItem("textsend.webAppExclusive", 1);
    } else {
        utools.dbStorage.removeItem("textsend.webAppExclusive");
    }
}

function readWebBlacklist() {
    const raw = utools.dbStorage.getItem("textsend.webBlacklist");
    if (raw == null || raw === "") {
        return [];
    }
    return String(raw).split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function writeWebBlacklist(list) {
    const uniq = [...new Set((list || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
    utools.dbStorage.setItem("textsend.webBlacklist", uniq.join(","));
    return uniq;
}

function getWebBlacklistText() {
    return readWebBlacklist().join("\n");
}

function setWebBlacklistText(text) {
    const list = String(text || "").split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    return writeWebBlacklist(list);
}

function isWebBlacklisted(host) {
    const h = String(host || "").trim().toLowerCase().replace(/^::ffff:/, "");
    return !!h && readWebBlacklist().includes(h);
}

function appServerUp() {
    const s = profile.currentServer;
    return !!(s && s.running);
}

function appClientsAlive() {
    if (!appServerUp()) {
        return false;
    }
    const peers = profile.currentServer.peers || [];
    for (const p of peers) {
        if (p && p.isAlive && p.isAlive()) {
            return true;
        }
    }
    return false;
}

function webReady() {
    return webBridge.isRunning() && webBridge.hasSession();
}

/**
 * @returns {{ app: boolean, web: boolean, block: string|null }}
 */
function routeSend() {
    if (profile.currentClient && profile.currentClient.isAlive()) {
        return { app: true, web: false, block: null };
    }
    const appUp = appServerUp();
    const appClients = appClientsAlive();
    const web = webReady();
    const webProc = webBridge.isRunning();
    const target = getSendTarget();

    // 只发兼容：绝不走 App
    if (target === "web") {
        if (web) {
            return { app: false, web: true, block: null };
        }
        return { app: false, web: false, block: webProc ? "兼容模式会话已过期" : "兼容模式未开" };
    }

    // 只发 App：绝不走网页（没有客户端就提示，不再回落网页）
    if (target === "app") {
        if (appClients) {
            return { app: true, web: false, block: null };
        }
        if (!appUp) {
            return { app: false, web: false, block: "服务未运行" };
        }
        return { app: false, web: false, block: "没有已连接的客户端" };
    }

    // 发给所有：App 服务没开时仍可只发网页
    if (!appUp) {
        if (web) {
            return { app: false, web: true, block: null };
        }
        return { app: false, web: false, block: webProc ? "兼容模式会话已过期" : "服务未运行" };
    }
    if (!appClients && !web) {
        return { app: false, web: false, block: webProc ? "兼容模式会话已过期" : "没有已连接的客户端" };
    }
    return { app: appClients, web, block: null };
}

function resetDefaults() {
    utools.dbStorage.setItem("textsend.sendTarget", "all");
    utools.dbStorage.removeItem("textsend.webAppExclusive");
    utools.dbStorage.setItem("textsend.webBlacklist", "");
}

module.exports = {
    getSendTarget,
    setSendTarget,
    getSendTargetIndex,
    setSendTargetIndex,
    getWebAppExclusive,
    setWebAppExclusive,
    readWebBlacklist,
    writeWebBlacklist,
    getWebBlacklistText,
    setWebBlacklistText,
    isWebBlacklisted,
    routeSend,
    webReady,
    resetDefaults,
};
