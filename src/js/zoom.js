const KEY = "textsend.zoom";
const MIN = 50;
const MAX = 150;

let current = 100;

export function clampZoom(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) {
        return 100;
    }
    return Math.min(MAX, Math.max(MIN, Math.round(x * 10) / 10));
}

export function applyZoom(n) {
    current = clampZoom(n);
    document.documentElement.style.zoom = String(current / 100);
    try {
        if (typeof window.setUiZoom === "function") {
            window.setUiZoom(current);
        } else {
            localStorage.setItem(KEY, String(current));
        }
    } catch (e) {
        /* ignore */
    }
    return current;
}

export function loadZoom() {
    let n = 100;
    try {
        if (typeof window.getUiZoom === "function") {
            n = window.getUiZoom();
        } else {
            n = Number(localStorage.getItem(KEY)) || 100;
        }
    } catch (e) {
        n = 100;
    }
    return applyZoom(n);
}

export function nudgeZoom(delta) {
    return applyZoom(current + delta);
}

export function zoomLabel() {
    const z = current;
    return Number.isInteger(z) ? z + "%" : z.toFixed(1) + "%";
}
