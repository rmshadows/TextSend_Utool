"use strict";

// 服务器消息自带的ID
const SERVER_ID = -200;
// 服务器成功接收的反馈信息
const FB_MSG = "cn.rmshadows.TextSend.ServerStatusFeedback";
// 单个Msg拆分的长度
const MSG_LEN = 1000;
// 加密用的Token
const AES_TOKEN = "cn.rmshadows.TS_TOKEN";
// 服务运行的端口号
let PORT = undefined;
// 猜测的IP地址
let Prefer_Addr = undefined;
// Socket Server服务是否正在运行
let is_running = false;
// 作为客户端使用时，生成的Socket
let client = null;
// 客户端是否连接
let client_connected = false;
// 网卡IP地址
let net_ip = [];


module.exports = {
    SERVER_ID, 
    FB_MSG,
    MSG_LEN,
    AES_TOKEN,
}

