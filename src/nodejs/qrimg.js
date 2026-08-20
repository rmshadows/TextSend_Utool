"use strict";
const QR = require("./mqrcode/mqrcode.cjs");
const path = require("path");
const system = require("./system");

function generateQR(content, saveto) {
    const tsm = system.getTimestamp();
    const p = "tsqrcode-" + tsm + ".png";
    const fp = path.join(saveto, p);
    try {
        QR.createQRSync(String(content), fp, 512, "png");
        return fp;
    } catch (error) {
        console.log(error);
        return "../assets/favicon.png";
    }
}

module.exports = {
    generateQR,
};
