import { defineStore } from 'pinia'

const DEFAULT_PLACEHOLDER = '../assets/favicon.png';

export const useQrStore = defineStore('Qr', {
    state: () => {
        return {
            qrImgSrc: DEFAULT_PLACEHOLDER,
            pin: "",
            pskB64: "",
            qrGen: 0,
            lastQrUri: "",
        }
    },
    actions: {
        bumpGen() {
            this.qrGen++;
        },
        setQrImgDefaultValue() {
            this.bumpGen();
            console.log("setQrImgDefaultValue: Reset二维码图片 => " + DEFAULT_PLACEHOLDER);
            this.qrImgSrc = DEFAULT_PLACEHOLDER;
            this.pin = "";
            this.pskB64 = "";
            this.lastQrUri = "";
        },
        setPin(pin) {
            this.pin = pin || "";
        },
        setPsk(pskB64) {
            this.pskB64 = pskB64 || "";
        },
        setQrImgValue(path) {
            console.log("setQrImgValue: Set二维码图片 " + this.qrImgSrc + " => " + path);
            this.qrImgSrc = path;
        },
        /** 服务端启动后刷新二维码（可多次调，用 qrGen 丢弃过期回调） */
        refreshServerQr(ip, port) {
            const psk = window.getPskB64 && window.getPskB64();
            const pin = window.getPin && window.getPin();
            if (psk) {
                this.setPsk(psk);
            }
            if (pin) {
                this.setPin(pin);
            }
            if (!psk || !ip) {
                return false;
            }
            const uri = window.formatUri(ip, port, psk);
            if (uri === this.lastQrUri && this.qrImgSrc && !String(this.qrImgSrc).includes("favicon")) {
                return true;
            }
            const qrpath = window.getQrImgPath(String(uri));
            if (!qrpath || String(qrpath).includes("favicon")) {
                return false;
            }
            this.lastQrUri = uri;
            const gen = this.qrGen;
            setTimeout(() => {
                if (this.qrGen !== gen) {
                    return;
                }
                this.setQrImgValue(qrpath);
            }, 200);
            return true;
        },
    },
})
