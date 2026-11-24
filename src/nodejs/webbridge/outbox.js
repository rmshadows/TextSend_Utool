"use strict";

/**
 * 电脑发到网页的文件。正文不进 SSE，浏览器按 id 分片来拉。
 * 同一文件系统上用硬链接；跨盘才复制。
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const FileNames = require("../protocol/fileNames");

const CHUNK = 1024 * 1024;
const MAX_SIZE = 20 * 1024 * 1024 * 1024;
const MAX_ITEMS = 100;
const ID_RE = /^[0-9a-f]{32}$/;

const items = new Map();

function newId() {
    return crypto.randomBytes(16).toString("hex");
}

async function offer(source, tree, rel, cancelled, progress) {
    if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
        throw new Error("不是文件");
    }
    const size = fs.statSync(source).size;
    if (size < 0 || size > MAX_SIZE) {
        throw new Error("size");
    }
    if (cancelled && cancelled()) {
        throw new Error("cancelled");
    }
    let safeRel = "";
    if (rel && String(rel).trim()) {
        safeRel = FileNames.sanitizeRelPath(rel);
        if (!safeRel) {
            throw new Error("path");
        }
    }
    if (tree && String(tree).trim()) {
        const folder = FileNames.sanitize(tree);
        safeRel = safeRel ? folder + "/" + safeRel : folder;
    }
    let name;
    if (safeRel) {
        const slash = safeRel.lastIndexOf("/");
        name = slash >= 0 ? safeRel.slice(slash + 1) : safeRel;
    } else {
        name = FileNames.sanitize(path.basename(source) || "file");
    }
    const kind = FileNames.isImageName(name) ? "image" : "file";
    const id = newId();
    const dir = path.join(FileNames.inboxDir(), ".webout");
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, id);
    const dirNorm = path.resolve(dir);
    if (!path.resolve(dest).startsWith(dirNorm + path.sep)) {
        throw new Error("path");
    }
    if (progress) {
        progress(name, 0, size);
    }
    let linked = false;
    try {
        fs.linkSync(source, dest);
        linked = true;
    } catch (e) {
        fs.rmSync(dest, { force: true });
    }
    if (linked) {
        if (progress) {
            progress(name, size, size);
        }
    } else {
        await copyTo(source, dest, name, size, cancelled, progress);
    }
    if (items.size >= MAX_ITEMS) {
        fs.rmSync(dest, { force: true });
        throw new Error("full");
    }
    const item = {
        id,
        name,
        rel: safeRel,
        size,
        kind,
        ts: Date.now(),
        file: dest,
    };
    items.set(id, item);
    return item;
}

function eventOf(item, type) {
    return {
        v: 1,
        type,
        id: item.id,
        name: item.name,
        rel: item.rel,
        size: item.size,
        kind: item.kind,
        ts: item.ts,
    };
}

function listJson() {
    const arr = [];
    for (const it of items.values()) {
        arr.push(eventOf(it, "file"));
    }
    return JSON.stringify({ v: 1, items: arr });
}

function readChunk(id, index) {
    if (!id || !ID_RE.test(id)) {
        throw new Error("missing");
    }
    const item = items.get(id);
    if (!item) {
        throw new Error("missing");
    }
    if (index < 0) {
        throw new Error("range");
    }
    const off = index * CHUNK;
    if (off >= item.size && item.size !== 0) {
        throw new Error("range");
    }
    if (item.size === 0) {
        throw new Error("range");
    }
    const n = Math.min(CHUNK, item.size - off);
    const buf = Buffer.alloc(n);
    const fd = fs.openSync(item.file, "r");
    try {
        let got = 0;
        while (got < n) {
            const r = fs.readSync(fd, buf, got, n - got, off + got);
            if (r <= 0) {
                throw new Error("changed");
            }
            got += r;
        }
    } catch (e) {
        if (e && e.code === "ENOENT") {
            throw new Error("missing");
        }
        throw e;
    } finally {
        fs.closeSync(fd);
    }
    return buf;
}

function drop(id) {
    const it = items.get(id);
    if (!it) {
        return null;
    }
    items.delete(id);
    fs.rmSync(it.file, { force: true });
    return it;
}

function clear() {
    wipe();
}

function discardAll() {
    wipe();
}

function wipe() {
    for (const it of items.values()) {
        fs.rmSync(it.file, { force: true });
    }
    items.clear();
}

async function copyTo(source, dest, name, size, cancelled, progress) {
    const buf = Buffer.alloc(CHUNK);
    let done = 0;
    const input = await fs.promises.open(source, "r");
    const output = await fs.promises.open(dest, "w");
    try {
        while (true) {
            if (cancelled && cancelled()) {
                throw new Error("cancelled");
            }
            const read = await input.read(buf, 0, buf.length, done);
            if (read.bytesRead <= 0) {
                break;
            }
            await output.write(buf, 0, read.bytesRead, done);
            done += read.bytesRead;
            if (progress) {
                progress(name, Math.min(done, size), size);
            }
        }
    } catch (e) {
        await input.close().catch(() => {});
        await output.close().catch(() => {});
        fs.rmSync(dest, { force: true });
        throw e;
    }
    await output.close();
    await input.close();
}

module.exports = {
    CHUNK,
    MAX_SIZE,
    offer,
    eventOf,
    listJson,
    readChunk,
    drop,
    clear,
    discardAll,
};
