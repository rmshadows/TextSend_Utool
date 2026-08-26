/** 三端仓库 / 下载页（与 PC/Android README 一致） */

export const ANDROID_DOWNLOAD = {
    github: "https://github.com/rmshadows/TextSend_Android/releases",
    gitee: "https://gitee.com/rmshadows/TextSend_Android/releases",
};

export function filePathToImgSrc(raw) {
    const s = raw == null ? "" : String(raw);
    if (!s || s.includes("favicon")) {
        return "";
    }
    if (s.startsWith("file://")) {
        return s;
    }
    if (s.startsWith("/") || /^[A-Za-z]:[\\/]/.test(s)) {
        return "file://" + s.replace(/\\/g, "/");
    }
    return s;
}

/** 用 preload 生成小二维码 PNG，返回可给 img 用的 src（同步，文件可能尚未可读） */
export function qrImgForUrl(url) {
    const fn = typeof window.getLinkQrImgPath === "function"
        ? window.getLinkQrImgPath
        : window.getQrImgPath;
    if (typeof fn !== "function") {
        return "";
    }
    return filePathToImgSrc(fn(String(url)));
}

/** 生成后延迟再交给 img，避免 file:// 首次读不到（与侧栏二维码一致） */
export function ensureLinkQrImg(url, onReady, delayMs = 200) {
    const fn = typeof window.getLinkQrImgPath === "function"
        ? window.getLinkQrImgPath
        : window.getQrImgPath;
    if (typeof fn !== "function") {
        onReady("");
        return;
    }
    const src = filePathToImgSrc(fn(String(url)));
    if (!src) {
        onReady("");
        return;
    }
    setTimeout(() => onReady(src), delayMs);
}

export function openExternalUrl(url) {
    const u = String(url || "").trim();
    if (!u) {
        return;
    }
    if (typeof window.openExternalUrl === "function") {
        window.openExternalUrl(u);
        return;
    }
    try {
        window.open(u, "_blank");
    } catch (e) {
        console.error("openExternalUrl failed:", e);
    }
}
