"use strict";
// 加密用的Token
const AES_TOKEN = "cn.rmshadows.TS_TOKEN";
// 服务器消息自带的ID
const SERVER_ID = -200;
// 服务器成功接收的反馈信息
const FB_MSG = "cn.rmshadows.TextSend.ServerStatusFeedback";
// 单个Msg拆分的长度
const MSG_LEN = 1000;

module.exports = {
    AES_TOKEN,
    SERVER_ID,
    FB_MSG,
    MSG_LEN,
}

