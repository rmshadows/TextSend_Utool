import * as tscu from "./tscu"

/**
 * 配置默认的IP
 * @param ref {IP数组} array 
 */
export const getDefaultIpAddr = (array) => {
    // 先查找192.168.1
    for (let i = 0; i < array.length; i++) {  //遍历数组
        if (String(array[i].value).includes("192.168.1.")) {
            return array[i].value;
        }
    }
    // 再查找192.168
    for (let i = 0; i < array.length; i++) {
        if (array[i].value.includes("192.168.")) {
            console.log("返回默认IP:" + array[i].value);
            return array[i].value;
        }
    }
    return "127.0.0.1";
}

export const getIpAddrList = () => {
    return tscu.getIpAddrList();
}

export const getQrImgPath = (ip, port) => {
    return tscu.getQrImgPath(ip, port);
}