// 注意：这里不能使用pinia
/**
 * 配置默认的IP
 * @param ref {IP数组} array 
 */
export const getDefaultIpAddr = (array) => {
    const vals = array.map((x) => String(x.value));
    for (let i = 0; i < vals.length; i++) {
        if (vals[i].startsWith("192.168.")) {
            return vals[i];
        }
    }
    let find172 = false;
    let prefer = null;
    for (let i = 0; i < vals.length; i++) {
        const ip = vals[i];
        if (ip.startsWith("172.")) {
            prefer = ip;
            find172 = true;
        } else if (ip.startsWith("10.") && !find172) {
            prefer = ip;
        }
    }
    if (prefer) {
        return prefer;
    }
    for (let i = 0; i < vals.length; i++) {
        const ip = vals[i];
        if (ip !== "127.0.0.1" && ip !== "::1" && !ip.toLowerCase().startsWith("fe80") && !ip.startsWith("169.254")) {
            return ip;
        }
    }
    return vals.length ? vals[0] : "127.0.0.1";
}


/**
 * Naive UI显示错误信息
 * @param {String} error 
 */
export const errorHandler = (error) => {
    // 需要确保已经在 setup 中执行了 window.$message = message
    window.$message.error(error, {
        closable: true,
        duration: 5000
    });
}


// U开头表示借助preload脚本的函数
/**
 * 更新IP地址列表(选择框) / U
 */
export const UgetIpAddrList = () => {
    let ips = window.getIpAddr();
    let ipA = [];
    for (let i = 0; i < ips.length; i++) {
        let seel = { label: ips[i], value: ips[i] }
        ipA.push(seel);
    }
    // console.log("返回IP列表:" + ipA);
    return ipA;
}


/**
 * 返回是否ipv6
 * @param {string} ip 
 * @returns 
 */
export const UisIpv6 = (ip) => {
    return window.isIPv6(ip);
}


/**
 * 生成二维码图片 tsc => preload =>  node
 * @param {*} ip 
 * @param {*} port 
 * @returns 
 */
export const UupdateQrImgPath = (content) => {
    return window.getQrImgPath(String(content));
}
