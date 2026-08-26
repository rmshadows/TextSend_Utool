import { defineStore } from 'pinia'
import { useMainbodyStore } from './mainbodyStore'

export const useTextsendStore = defineStore('textsend', {
    state: () => {
        return {
            // IP列表
            ipAddrList: [],
            ipAddr: "",
            // 选取的端口号
            portNumber: 54300,
            // 文本框默认文字
            inputText: "",
            // 是否加载中
            isLoading: false,
        }
    },
    getters: {
        /**
         * 获取文本输入框默认文字
         * @returns String
         */
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
                    return "粘贴 ts:// 或 IP/kPIN，端口可省略（默认 54300），例如 192.168.31.1/k38492017";
                }
            }
        },
        /**
         * 获取启动按钮所需的文字
         * @returns String
         */
        getLaunchBtnText() {
            const mbStore = useMainbodyStore();
            // 如果是服务端
            if (mbStore.serverMode) {
                // 如果服务启动
                if (mbStore.isServerStart) {
                    return "停止";
                } else {
                    return "启动";
                }
            } else {
                // 如果是客户端模式
                if (mbStore.isConnected) {
                    return "断开";
                } else {
                    return "连接";
                }
            }
        },
        /**
         * 更改模式按钮文字
         * @returns String
         */
        getChangeModeBtnText() {
            const mbStore = useMainbodyStore();
            if (mbStore.isConnected) {
                return "发送";
            } else {
                return "切换";
            }
        },
    },
    actions: {
        /**
         * IP列表JSON
         * @param {JSON} value 
         */
        setIpAddrListValue(value) {
            // console.log("setIpAddrListValue: 设置IP下拉框列表 => " + JSON.stringify(value));
            this.ipAddrList = value;
        },
        /**
         * 从IP列表中猜的默认IP（192开头）
         * @param {String} value 
         */
        setIpAddrValue(value) {
            // console.log("setIpAddrValue: 设置IP地址 => " + value);
            this.ipAddr = value;
        },
        /**
         * 设置端口号
         * @param {String | Number} value 
         */
        setPortNumberValue(value) {
            this.portNumber = value;
        },
        /**
         * 修改文本框内容(内部或者小段文字时调用)
         * @param {String} value 
         */
        setInputValueSync(value) {
            this.inputText = value;
        },
        /**
         * 是否显示文本框加载中
         * @param {boolean} value 
         */
        setIsLoadingValue(value) {
            if (value != this.isLoading) {
                this.isLoading = value;
            }
        },
        /**
         * 文本框输入大段文字（虽然好像也没啥用）
         * @param {String} value 
         */
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