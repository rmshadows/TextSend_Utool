import { defineStore } from 'pinia'
import { useMainbodyStore } from './mainbodyStore'

export const useTextsendStore = defineStore('textsend', {
    state: () => {
        return {
            // IP列表
            ipAddrList: [{
                "label": "127.0.0.1",
                "value": "127.0.0.1"
            },
            {
                "label": "::1",
                "value": "::1"
            },
            {
                "label": "192.168.30.126",
                "value": "192.168.30.126"
            }],
            // 选取的IP
            ipAddr: "127.0.0.1",
            // 选取的端口号
            portNumber: 54300,
            // 文本框默认文字
            inputText: "",
            // 是否加载中
            isLoading: false,
            // 按钮文字
            launchBtnText: "启&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;动",
            changeModeBtnText: "切&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;换",
        }
    },
    getters: {
        // 获取文本输入框默认文字
        getInputTextPlaceholder() {
            // 访问mainbodyStore
            const mbStore = useMainbodyStore();
            if (mbStore.serverMode) {
                return "请输入要发送的文字";
            } else {
                // 客户端模式
                if (mbStore.isConnected) {
                    return "请输入要发送的文字";
                } else {
                    return "请输入服务端[IP地址]:[端口号]，如：192.168.1.2:54301 或者 192.168.1.2 (不加端口号默认54300) ";
                }
            }
        },
        // 获取启动按钮所需的文字
        getLaunchBtnText() {
            const mbStore = useMainbodyStore();
            // 如果是服务端
            if (mbStore.serverMode) {
                // 如果服务启动
                if (mbStore.isServerStart) {
                    return " 停&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;止 ";
                } else {
                    return " 启&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;动 ";
                }
            } else {
                // 如果是客户端模式
                if (mbStore.isConnected) {
                    return " 断&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;开 ";
                } else {
                    return " 连&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;接 ";
                }
            }
        },
        // 更改模式按钮文字
        getChangeModeBtnText() {
            const mbStore = useMainbodyStore();
            if (mbStore.isConnected) {
                return " 发&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;送 ";
            } else {
                return " 切&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;换 ";
            }
        },
    },
    actions: {
        setIpAddrListValue(value) {
            console.log("setIpAddrListValue: 设置IP下拉框列表 => " + JSON.stringify(value));
            this.ipAddrList = value;
        },
        setIpAddrValue(value) {
            console.log("setIpAddrValue: 设置IP地址 => " + value);
            this.ipAddr = value;
        },
        setPortNumberValue(value) {
            console.log("setPortNumberValue: 设置端口号 => " + value);
            this.portNumber = value;
        },
        setInputValueSync(value) {
            console.log("setInputValue: 设置文本框内容 => " + value);
            this.inputText = value;
        },
        changeIsLoadingValue() {
            if (this.isLoading) {
                this.isLoading = false;
            } else {
                this.isLoading = true;
            }
            console.log("changeIsLoadingValue: => " + this.isLoading);
        },
        setIsLoadingValue(value) {
            if (value != this.isLoading) {
                this.isLoading = value;
                console.log("set isLoading value to " + this.isLoading);
            }
        },
        async setInputTextValue(value) {
            new Promise((resolve, reject) => {
                this.setIsLoadingValue(true);
                resolve();
            });
            new Promise((resolve, reject) => {
                this.setInputValueSync(value);
                resolve();
            }).then(() => {
                this.setIsLoadingValue(false);
            });
        },
    },
})