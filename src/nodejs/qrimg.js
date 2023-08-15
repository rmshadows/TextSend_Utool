"use strict";
const QR = require("./mqrcode/mqrcode.cjs");

function generateQR(ip, port) {
    let p = "qrcode.png";
    try {
        let content = String(ip) + ":" + String(port);
        QR.createQRSync(content, p, 512, "png");
        return p;
    } catch (error) {
        console.log(error);
        return "../assets/favicon.png";
    }
}


module.exports = {
    generateQR,
}

// generateQR("192.168.1.1", "54300");
