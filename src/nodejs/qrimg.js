"use strict";
const QR = require("./mqrcode/mqrcode.cjs");
const path = require("path");
const system = require("./system");

function generateQR(content, saveto, width = 512) {
    const tsm = system.getTimestamp();
    const p = "tsqrcode-" + tsm + ".png";
    const fp = path.join(saveto, p);
    const side = Number(width) > 0 ? Number(width) : 512;
    try {
        QR.createQRSync(String(content), fp, side, "png");
        return fp;
    } catch (error) {
        console.log(error);
        return "../assets/favicon.png";
    }
}

module.exports = {
    generateQR,
};
