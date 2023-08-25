import { defineStore } from 'pinia';
import { useQrStore } from './qrStore';
import { useTextsendStore } from './textsendStore';
import { errorHandler } from "../js/tsc";

// 你可以对 `defineStore()` 的返回值进行任意命名，但最好使用 store 的名字，同时以 `use` 开头且以 `Store` 结尾。(比如 `useUserStore`，`useCartStore`，`useProductStore`)
// 第一个参数是你的应用中 Store 的唯一 ID。
export const useMainbodyStore = defineStore('mainbody', {
    // 为了完整类型推理，推荐使用箭头函数
    state: () => {
        return {
            // 所有这些属性都将自动推断出它们的类型
            appName: "Textsend uTools 插件",
            version: "0.0.4",
            author: "Ryan Yim",
            serverMode: true, // 服务状态：服务端或者客户端
            // 链接状态从utools preload查询来
            isConnected: false, // 是否已连接
            isServerStart: false, // 服务端是否已启动(仅服务端) 只能从Action更改
            disableChangeModeBtn: false, // 是否禁用切换按钮
            clientSocketStat: -1, // 客户端状态 -1:初始化 0:正在连接 1:连接成功 2:失败 3:连接成功后又再断开
        }
    },
    getters: {
        // 如果getter带参数，getter 将不再被缓存，它们只是一个被你调用的函数
        // 是否禁用模式切换按钮
        getDisableChangeModeBtn() {
            if (this.serverMode) {
                // 启动服务但未链接时
                if (this.isServerStart && !this.isConnected) {
                    this.setDisableChangeModeBtn(true);
                    return true;
                } else {
                    this.setDisableChangeModeBtn(false);
                    return false;
                }
            } else {
                // 客户端正在连接时 禁用
                if (this.clientSocketStat == 0) {
                    this.setDisableChangeModeBtn(true);
                    return true;
                } else {
                    this.setDisableChangeModeBtn(false);
                    return false;
                }
            }

        },
    },
    actions: {
        // 服务端启动
        async serverStart(port, maxConnections) {
            // 启动服务
            try {
                await window.startServer(port, maxConnections);
                this.setServerStart();
                // 首先轮询服务是否成功启动 随后（如果成功启动）自动进行连接轮询
                this.getIfServerStartSuccessful(500, 10);
            } catch (error) {
                console.log("mainbodyStore => action:serverStart(): " + error);
                this.setServerStop();
                //  启动失败就重设二维码图片
                const qrStore = useQrStore();
                setTimeout(() => {
                    qrStore.setQrImgDefaultValue();
                }, 2000);
            }
        },
        // 服务端停止
        async serverStop() {
            try {
                await window.stopServer();
                //  启动失败就重设二维码图片
                const qrStore = useQrStore();
                setTimeout(() => {
                    qrStore.setQrImgDefaultValue();
                }, 1000);
                this.setServerStop();
            } catch (error) {
                console.log("mainbodyStore => action:serverStop(): " + error);
            }
        },
        // 客户端模式启动
        async clientStart(ip, port) {
            /**
             * 点击客户端启动按钮后，开始轮询
             */
            try {
                // 尝试连接
                this.clientSocketStat = 0;
                await window.startClient(ip, port);
                this.getIfClientStartSuccessful(500, 10);
                this.setClientStart();
            } catch (error) {
                this.setClientStop();
                console.log("mainbodyStore => action:clientStart(ip, port): " + error);
            }
        },
        // 客户端模式停止、断开
        async clientStop() {
            // 这里是主动断开连接，停止客户端
            try {
                console.log("mvStore:Client断开中...");
                this.clientSocketStat = 3;
                await window.stopClient();
                this.setClientStop();
            } catch (error) {
                console.log("mainbodyStore => action:clientStop(): " + error);
            }
        },
        // 查询node模块Socket连接状态(默认半秒查询一次) 控制开关是否可以发送文字
        getNodeSocketsConnectStat(gap = 500) {
            // 服务模式开始或者客户端连接没断(客户端在连接成功时才调用这个方法)才会开始轮询
            if (this.serverMode) { // 服务端模式时
                // 如果服务启动
                if (this.isServerStart) {
                    // 如果连接不为0
                    if (window.getConnectionStat()[1] != 0) {
                        this.setConnectStat(true);
                        // Socket在的情况下，如果收到反馈，清空文字
                        if (window.getMsgFeedbackStat()) {
                            const tsStore = useTextsendStore();
                            tsStore.setInputValueSync("");
                            // console.log("清空文字");
                            // 复原
                            window.setClearStat(false);
                        }
                    } else {
                        this.setConnectStat(false);
                    }
                    setTimeout(() => {
                        this.getNodeSocketsConnectStat(gap);
                    }, gap);
                } else {
                    this.setConnectStat(false);
                }
            } else { // 客户端模式时
                // 连接成功的还在
                if (this.clientSocketStat = 1) {
                    // 如果连接不为0 
                    if (window.getConnectionStat()[1] != 0) {
                        this.setConnectStat(true);
                        // Socket在的情况下，如果收到反馈，清空文字
                        if (window.getMsgFeedbackStat()) {
                            const tsStore = useTextsendStore();
                            tsStore.setInputValueSync("");
                            // console.log("清空文字");
                            // 复原
                            window.setClearStat(false);
                        }
                        setTimeout(() => {
                            this.getNodeSocketsConnectStat(gap);
                        }, gap);
                    } else {
                        // 如果断链
                        this.setConnectStat(false);
                        // 表示服务器主动断开
                        this.clientSocketStat = 3;
                    }
                }
            }
        },
        // 轮询服务启动是否成功(超时10秒) 
        async getIfServerStartSuccessful(gap = 500, timeoutSecond = 10) {
            // 是否超时
            let isTimeout = false;
            let success = false;
            setTimeout(() => {
                isTimeout = true;
            }, timeoutSecond * 1000);
            // 当点下启动服务时即开始轮询 直至10秒内发现启动失败 
            while (!isTimeout && this.serverStart) {
                // 还没超时以及服务启动状态就会进入循环 
                let stat = window.startSuccessful();
                if (stat == 1) {
                    // 如果成功启动 开始监听连接
                    this.getNodeSocketsConnectStat(gap);
                    success = true;
                    isTimeout = true;
                } else if (stat == 2) {
                    // 启动失败
                    success = false;
                    isTimeout = true;
                    if (!success) {
                        // 如果启动失败，弹窗
                        errorHandler("服务启动失败。");
                    }
                }
                // 等待超时
                await new Promise((resolve, reject) => {
                    setTimeout(resolve, gap);
                });
            }
            // 没启动成功就结束
            if (this.serverStart && !success) {
                this.serverStop();
            }
            // 还原参数，避免下次调用失败
            window.setStartStatus(0);
        },
        async getIfClientStartSuccessful(gap = 500, timeoutSecond = 10) {
            // 是否超时
            let isClientTimeout = false;
            let success = false;
            setTimeout(() => {
                isClientTimeout = true;
            }, timeoutSecond * 1000);
            // 当点下连接客户端时即开始轮询 直至10秒内发现启动失败 
            while (!isClientTimeout && !this.serverMode) {
                // 还没超时以及客户端模式状态就会进入循环 
                let stat = window.startSuccessful();
                if (stat == 1) {
                    // 如果连接成功 开始监听连接
                    this.clientSocketStat = 1;
                    // 开始轮询连接状态
                    this.getNodeSocketsConnectStat(gap);
                    success = true;
                    isClientTimeout = true;
                } else if (stat == 2) {
                    // 连接失败
                    success = false;
                    isClientTimeout = true;
                    this.clientSocketStat = 2;
                    if (!success) {
                        // 失败，弹窗
                        errorHandler("客户端连接失败。");
                    }
                }
                // 等待超时
                await new Promise((resolve, reject) => {
                    setTimeout(resolve, gap);
                });
            }
            // 没切换模式了就结束
            if (!this.serverMode && !success) {
                this.clientStop();
            }
            // 还原参数，避免下次调用失败
            window.setStartStatus(0);
        },
        setServerStart() {
            this.setServerStat(true);
            // 启动服务后会禁用切换按钮
            // this.setDisableChangeModeBtn(true);
        },
        // 服务端停止
        setServerStop() {
            this.setServerStat(false);
            // this.setDisableChangeModeBtn(false);
        },
        // 客户端模式启动
        setClientStart(value) {
            // 尝试连接
            this.clientSocketStat = false;
        },
        // 客户端模式停止、断开
        setClientStop(value) {
            // 这里是主动断开连接，停止客户端
            this.clientSocketStat = true;
        },
        // 修改模式状态
        changeServerMode() {
            if (this.serverMode) {
                this.serverMode = false;
                console.log("切换客户端模式");
            } else {
                this.serverMode = true;
                // 防客户端连接中切换出错
                this.clientSocketStat = false;
                console.log("切换服务端模式");
            }
        },
        // 设置连接状态
        setConnectStat(value) {
            if (value != this.isConnected) {
                this.isConnected = value;
                value ? console.log("设置连接成功状态") : console.log("设置连接断开状态");
            }
        },
        changeConnectStat() {
            if (this.isConnected) {
                this.isConnected = false;
            } else {
                this.isConnected = true;
            }
        },
        setServerStat(value) {
            if (value) {
                this.isServerStart = true;
                console.log("设置服务端启动状态");
            } else {
                this.isServerStart = false;
                console.log("设置服务端停止状态");
            }
        },
        changeServerStat() {
            if (this.isServerStart) {
                this.isServerStart = false;
                console.log("服务端停止");
            } else {
                this.isServerStart = true;
                console.log("服务端启动");
            }
        },
        setDisableChangeModeBtn(value) {
            this.disableChangeModeBtn = value;
        }
    },
})