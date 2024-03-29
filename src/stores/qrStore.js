import { defineStore } from 'pinia'

export const useQrStore = defineStore('Qr', {
    state: () => {
        return {
            // 二维码图片源
            qrImgSrc: "../assets/favicon.png",
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