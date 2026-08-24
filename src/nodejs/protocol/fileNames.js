"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const FOLDER = "TextSend";
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "tif", "tiff"]);

function downloads() {
    try {
        if (typeof utools !== "undefined" && utools.getPath) {
            const d = utools.getPath("downloads");
            if (d && fs.existsSync(d)) {
                return d;
            }
        }
    } catch (e) {
        /* ignore */
    }
    const home = os.homedir() || ".";
    const plat = process.platform;
    if (plat === "win32") {
        const up = process.env.USERPROFILE || home;
        const dl = path.join(up, "Downloads");
        return fs.existsSync(dl) ? dl : up;
    }
    if (plat === "darwin") {
        const dl = path.join(home, "Downloads");
        return fs.existsSync(dl) ? dl : home;
    }
    try {
        const line = execSync("xdg-user-dir DOWNLOAD", { encoding: "utf8", timeout: 2000 }).trim();
        if (line && fs.existsSync(line)) {
            return line;
        }
    } catch (e) {
        /* ignore */
    }
    const dl = path.join(home, "Downloads");
    if (fs.existsSync(dl)) {
        return dl;
    }
    const zh = path.join(home, "下载");
    return fs.existsSync(zh) ? zh : home;
}

function inboxDir() {
    const dir = path.join(downloads(), FOLDER);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function isImageName(name) {
    const ext = extOf(name);
    return ext != null && IMAGE_EXT.has(ext);
}

function sanitize(name) {
    let n = name == null ? "" : String(name).replace(/\\/g, "/");
    const slash = n.lastIndexOf("/");
    if (slash >= 0) {
        n = n.substring(slash + 1);
    }
    n = n.replace(/[\x00-\x1f<>:"|?*]/g, "_").trim();
    if (n === "." || n === ".." || n === "") {
        n = "file";
    }
    const lower = n.toLowerCase();
    if (lower === "con" || lower === "prn" || lower === "aux" || lower === "nul"
        || /^com[1-9]$/.test(lower) || /^lpt[1-9]$/.test(lower)) {
        n = "_" + n;
    }
    if (n.length > 120) {
        let ext = "";
        const dot = n.lastIndexOf(".");
        if (dot > 0 && dot >= n.length - 8) {
            ext = n.substring(dot);
            n = n.substring(0, dot);
        }
        n = n.substring(0, Math.max(1, 120 - ext.length)) + ext;
    }
    return n;
}

function sanitizeRelPath(raw) {
    if (raw == null || String(raw).trim() === "") {
        return null;
    }
    let n = String(raw).replace(/\\/g, "/").trim();
    if (n.startsWith("/") || /^[A-Za-z]:/.test(n)) {
        return null;
    }
    const parts = [];
    for (const p of n.split("/")) {
        if (!p || p === ".") {
            continue;
        }
        if (p === "..") {
            return null;
        }
        parts.push(sanitize(p));
    }
    return parts.length === 0 ? null : parts.join("/");
}

function resolveUnder(root, rel) {
    const r = path.resolve(root);
    let p = r;
    for (const seg of String(rel).split("/")) {
        if (!seg) {
            continue;
        }
        p = path.join(p, seg);
    }
    p = path.resolve(p);
    const relTo = path.relative(r, p);
    if (relTo.startsWith("..") || path.isAbsolute(relTo)) {
        throw new Error("path");
    }
    return p;
}

function uniqueDir(parent, sanitized) {
    let cand = path.join(parent, sanitized);
    if (!fs.existsSync(cand)) {
        fs.mkdirSync(cand, { recursive: true });
        return cand;
    }
    for (let i = 1; i < 10000; i++) {
        cand = path.join(parent, sanitized + " (" + i + ")");
        if (!fs.existsSync(cand)) {
            fs.mkdirSync(cand, { recursive: true });
            return cand;
        }
    }
    throw new Error("too many duplicates: " + sanitized);
}

function unique(dir, sanitized) {
    let cand = path.join(dir, sanitized);
    if (!fs.existsSync(cand)) {
        return cand;
    }
    let stem = sanitized;
    let ext = "";
    const dot = sanitized.lastIndexOf(".");
    if (dot > 0) {
        stem = sanitized.substring(0, dot);
        ext = sanitized.substring(dot);
    }
    for (let i = 1; i < 10000; i++) {
        cand = path.join(dir, stem + " (" + i + ")" + ext);
        if (!fs.existsSync(cand)) {
            return cand;
        }
    }
    throw new Error("too many duplicates: " + sanitized);
}

function skipJunk(name) {
    if (!name || name === "." || name === "..") {
        return true;
    }
    const lower = name.toLowerCase();
    if (lower === ".ds_store" || lower === "thumbs.db" || lower === "desktop.ini") {
        return true;
    }
    return lower.startsWith(".textsend.")
        || lower.endsWith(".textsend.part")
        || lower.endsWith(".textsend.json")
        || lower.endsWith(".textsend.receiving");
}

function extOf(name) {
    if (!name) {
        return null;
    }
    const dot = name.lastIndexOf(".");
    if (dot < 0 || dot === name.length - 1) {
        return null;
    }
    return name.substring(dot + 1).toLowerCase();
}

module.exports = {
    FOLDER,
    downloads,
    inboxDir,
    isImageName,
    sanitize,
    sanitizeRelPath,
    resolveUnder,
    uniqueDir,
    unique,
    skipJunk,
};
