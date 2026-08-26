"use strict";

const os = require("os");

function hostOf(info) {
    return String(info.address || "").split("%")[0];
}

function isDropped(info) {
    const raw = hostOf(info);
    if (!raw || raw === "0.0.0.0" || raw === "::") {
        return true;
    }
    const fam = info.family;
    if (fam === "IPv4" || fam === 4) {
        const a = parseInt(raw.split(".")[0], 10);
        if (a >= 224) {
            return true;
        }
    }
    return false;
}

/** 回环 / 链路本地：列表末尾，不当默认 */
function isJunk(info) {
    const raw = hostOf(info);
    if (info.internal) {
        return true;
    }
    if (raw === "127.0.0.1" || raw === "::1") {
        return true;
    }
    return raw.toLowerCase().startsWith("fe80") || raw.startsWith("169.254");
}

function familyOk(info, type) {
    const fam = info.family;
    const v4 = fam === "IPv4" || fam === 4;
    const v6 = fam === "IPv6" || fam === 6;
    if (type === 1) {
        return v4;
    }
    if (type === 2) {
        return v6;
    }
    return true;
}

/**
 * 获取 IP。局域网在前，127 / fe80 / 169.254 在后。
 * @param {Number} type 0=全部 1=IPv4 2=IPv6
 */
function getIpAddr(type = 0) {
    const lan = [];
    const junk = [];
    const nfs = os.networkInterfaces();
    for (const networkname in nfs) {
        for (const info of nfs[networkname]) {
            if (!familyOk(info, type) || isDropped(info)) {
                continue;
            }
            const host = hostOf(info);
            const bucket = isJunk(info) ? junk : lan;
            if (bucket.indexOf(host) === -1) {
                bucket.push(host);
            }
        }
    }
    return lan.concat(junk);
}

function getTimestamp() {
    return Number(new Date().getTime());
}

module.exports = {
    getIpAddr,
    getTimestamp,
};
