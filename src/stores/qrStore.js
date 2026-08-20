import { defineStore } from 'pinia'

export const useQrStore = defineStore('Qr', {
    state: () => {
        return {
            qrImgSrc: "../assets/favicon.png",
            pin: "",
            pskB64: "",
        }
    },
    getters: {

    },
    actions: {
        /**
         * Reset二维码图片
         */
        setQrImgDefaultValue() {
            console.log("setQrImgDefaultValue: Reset二维码图片 => ../assets/favicon.png");
            this.qrImgSrc = "../assets/favicon.png";
            this.pin = "";
            this.pskB64 = "";
        },
        setPin(pin) {
            this.pin = pin || "";
        },
        setPsk(pskB64) {
            this.pskB64 = pskB64 || "";
        },
        /**
         * 修改图片路径
         * @param {String} path 路径
         */
        setQrImgValue(path) {
            console.log("setQrImgValue: Set二维码图片 " + this.qrImgSrc + " => " + path);
            this.qrImgSrc = path;
        },
    },
})