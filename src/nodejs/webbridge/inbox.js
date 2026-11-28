"use strict";

/**
 * 网页桥分片落盘。同一 id 再次 begin 时返回已写入偏移，供断点续传。
 * 半截在「下载/TextSend/.webpart」。
 */

const fs = require("fs");
const path = require("path");
const FileNames = require("../protocol/fileNames");

const CHUNK = 1024 * 1024;
const FORCE_EVERY = 4 * 1024 * 1024;
const MAX_SIZE = 20 * 1024 * 1024 * 1024;
const KEEP_MS = 72 * 60 * 60 * 1000;
const ID_RE = /^[0-9a-fA-F]{16,64}$/;

const parts = new Map();
let watch = null;

function setWatch(next) {
    watch = next;
}

function begin(id, name, rel, size, clip) {
    if (!id || !ID_RE.test(id)) {
        throw new Error("id");
    }
    if (size < 0 || size > MAX_SIZE) {
        throw new Error("size");
    }
    sweep();
    const existing = parts.get(id);
    if (existing && existing.size === size && fs.existsSync(existing.file) && fs.statSync(existing.file).isFile()) {
        existing.aborted = false;
        existing.paused = false;
        notifyProgress(existing);
        return json(existing);
    }
    if (existing) {
        closeChannel(existing);
        fs.rmSync(existing.file, { force: true });
        parts.delete(id);
    }
    const dir = path.join(FileNames.inboxDir(), ".webpart");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, id + ".part");
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, Buffer.alloc(0));
    }
    let written = fs.statSync(file).size;
    if (written > size) {
        fs.writeFileSync(file, Buffer.alloc(0));
        written = 0;
    }
    const aligned = Math.floor(written / CHUNK) * CHUNK;
    if (aligned !== written) {
        fs.truncateSync(file, aligned);
        written = aligned;
    }
    const part = {
        id,
        name: name || "",
        rel: rel || "",
        size,
        clip: !!clip,
        written,
        file,
        fd: null,
        forced: 0,
        aborted: false,
        paused: false,
    };
    parts.set(id, part);
    notifyProgress(part);
    return json(part);
}

function chunk(id, index, data) {
    const part = parts.get(id);
    if (!part) {
        throw new Error("missing");
    }
    if (part.aborted) {
        throw new Error("cancelled");
    }
    if (index < 0 || !data) {
        throw new Error("index");
    }
    const off = index * CHUNK;
    if (data.length > CHUNK || off + data.length > part.size) {
        throw new Error("size");
    }
    if (off + data.length <= part.written) {
        return;
    }
    if (off !== part.written) {
        throw new Error("order");
    }
    const last = off + data.length === part.size;
    if (!last && data.length !== CHUNK) {
        throw new Error("short");
    }
    if (part.fd == null) {
        part.fd = fs.openSync(part.file, "r+");
    }
    fs.writeSync(part.fd, data, 0, data.length, off);
    part.written = off + data.length;
    if (last || part.written - part.forced >= FORCE_EVERY) {
        fs.fsyncSync(part.fd);
        part.forced = part.written;
    }
    notifyProgress(part);
}

function pause(id) {
    let name = "";
    let hit = false;
    for (const part of parts.values()) {
        if (id && id !== part.id) {
            continue;
        }
        if (part.aborted) {
            continue;
        }
        part.paused = true;
        name = label(part);
        hit = true;
    }
    if (hit && watch && watch.paused) {
        watch.paused(name);
    }
}

/** 本机点取消：中止进行中的网页上传，半截仍留在磁盘供续传。 */
function abortActive() {
    let name = "";
    let n = 0;
    for (const part of parts.values()) {
        if (part.aborted) {
            continue;
        }
        part.aborted = true;
        closeChannel(part);
        name = label(part);
        n++;
    }
    if (n > 0 && watch && watch.aborted) {
        watch.aborted(name);
    }
    return n;
}

function finish(id) {
    const part = parts.get(id);
    if (!part) {
        throw new Error("missing");
    }
    if (part.aborted) {
        throw new Error("cancelled");
    }
    if (part.written !== part.size) {
        throw new Error("incomplete");
    }
    closeChannel(part);
    const dest = destFor(part.name, part.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
        fs.renameSync(part.file, dest);
    } catch (e) {
        fs.copyFileSync(part.file, dest);
        fs.rmSync(part.file, { force: true });
    }
    parts.delete(id);
    if (watch && watch.finished) {
        watch.finished();
    }
    return { path: dest, clip: part.clip, size: part.size };
}

function discardAll() {
    let live = false;
    for (const part of parts.values()) {
        if (!part.aborted) {
            live = true;
        }
        closeChannel(part);
    }
    parts.clear();
    if (live && watch && watch.finished) {
        watch.finished();
    }
}

function closeChannel(part) {
    if (!part || part.fd == null) {
        return;
    }
    try {
        fs.fsyncSync(part.fd);
        fs.closeSync(part.fd);
    } catch (e) {
        try {
            fs.closeSync(part.fd);
        } catch (e2) {
            /* 半截还在 */
        }
    }
    part.fd = null;
}

function label(part) {
    if (part.rel && part.rel.trim()) {
        return part.rel;
    }
    if (part.name && part.name.trim()) {
        return part.name;
    }
    return "文件";
}

function notifyProgress(part) {
    if (!watch || !watch.progress || part.aborted || part.paused) {
        return;
    }
    watch.progress(label(part), part.written, part.size);
}

function sweep() {
    try {
        const dir = path.join(FileNames.inboxDir(), ".webpart");
        if (!fs.existsSync(dir)) {
            return;
        }
        const cutoff = Date.now() - KEEP_MS;
        for (const fn of fs.readdirSync(dir)) {
            if (!fn.endsWith(".part")) {
                continue;
            }
            const id = fn.slice(0, -5);
            if (parts.has(id)) {
                continue;
            }
            const file = path.join(dir, fn);
            const st = fs.statSync(file);
            if (st.mtimeMs < cutoff) {
                fs.rmSync(file, { force: true });
            }
        }
    } catch (e) {
        /* 清不掉旧半截不影响这次传输 */
    }
}

function json(part) {
    return JSON.stringify({ v: 1, id: part.id, next: part.written, chunk: CHUNK });
}

function destFor(name, rel) {
    const root = FileNames.inboxDir();
    if (rel && String(rel).trim()) {
        const safe = FileNames.sanitizeRelPath(rel);
        if (!safe) {
            throw new Error("path");
        }
        let dest = FileNames.resolveUnder(root, safe);
        const parent = path.dirname(dest);
        fs.mkdirSync(parent, { recursive: true });
        if (fs.existsSync(dest)) {
            dest = FileNames.unique(parent, path.basename(dest));
        }
        return dest;
    }
    const safeName = FileNames.sanitize(!name || !String(name).trim() ? "file" : name);
    return FileNames.unique(root, safeName);
}

module.exports = {
    CHUNK,
    MAX_SIZE,
    setWatch,
    begin,
    chunk,
    pause,
    abortActive,
    finish,
    discardAll,
};
