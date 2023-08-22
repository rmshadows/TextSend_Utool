import { defineStore } from 'pinia'
import { useQrStore } from './qrStore'

// 你可以对 `defineStore()` 的返回值进行任意命名，但最好使用 store 的名字，同时以 `use` 开头且以 `Store` 结尾。(比如 `useUserStore`，`useCartStore`，`useProductStore`)
// 第一个参数是你的应用中 Store 的唯一 ID。
export const useMainbodyStore = defineStore('mainbody', {
    // 为了完整类型推理，推荐使用箭头函数
    state: () => {
        return {
            // 所有这些属性都将自动推断出它们的类型
            appName: "Textsend uTools 插件",
            version: "0.0.2",
            author: "Ryan Yim",
            serverMode: true, // 服务状态：服务端或者客户端
            isConnected: false, // 是否已连接
            isServerStart: false, // 服务端是否已启动(仅服务端) 只能从Action更改
            disableChangeModeBtn: false, // 是否禁用切换按钮
        }
    },
    getters: {
        // 如果getter带参数，getter 将不再被缓存，它们只是一个被你调用的函数
        // 是否禁用模式切换按钮
        getDisableChangeModeBtn() {
            // 启动服务但未链接时
            if (this.isServerStart && !this.isConnected) {
                return true;
            } else {
                return false;
            }
        },
        // 查询链接状态
        // isConnectedValue() {
        //     if (this.serverMode) {
        //         if(window.getServerStat()[0] != 0){
        //             // this.isConnected = true;
        //             return true;
        //         }else{
        //             // this.isConnected = false;
        //             return false;
        //         }
        //     } else {

        //     }
        // },
    },
    actions: {
        // TODO: 写完Node模块后补充
        // 服务端启动
        async serverStart(port) {
            // 启动服务
            try {
                await window.startServer(port);
                this.setServerStart();
            } catch (error) {
                console.log("serverStart(): " + error);
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
                this.setServerStop();
            } catch (error) {
                console.log("serverStop(): " + error);
            }
        },
        // 客户端模式启动
        async clientStart(value) {
            // 尝试连接
        },
        // 客户端模式停止、断开
        async clientStop(value) {
            // 这里是主动断开连接，停止客户端
        },
        setServerStart() {
            this.setServerStat(true);
            // 启动服务后会禁用切换按钮
            this.setDisableChangeModeBtn(true);
        },
        // 服务端停止
        setServerStop() {
            this.setServerStat(false);
            this.setDisableChangeModeBtn(false);
        },
        // 客户端模式启动
        setClientStart(value) {
            // 尝试连接
        },
        // 客户端模式停止、断开
        setClientStop(value) {
            // 这里是主动断开连接，停止客户端
        },
        // 修改模式状态
        changeServerMode() {
            if (this.serverMode) {
                this.serverMode = false;
                console.log("切换客户端模式");
            } else {
                this.serverMode = true;
                console.log("切换服务端模式");
            }
        },
        // 设置连接状态
        setConnectStat(value) {
            if (value) {
                this.isConnected = true;
                console.log("设置连接成功状态");
            } else {
                this.isConnected = false;
                console.log("设置连接断开状态");
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