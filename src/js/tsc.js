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


// U开头表示借助preload脚本的函数
/**
 * 更新IP地址列表(选择框) / U
 */
export const UgetIpAddrList = () => {
    // TODO:DEBUG
    let ips = window.getIpAddr();
    let ipA = [];
    for (let i = 0; i < ips.length; i++) {
        let seel = { label: ips[i], value: ips[i] }
        ipA.push(seel);
    }
    console.log("返回IP列表:" + ipA);
    return ipA;
    // return [{
    //     "label": "127.0.0.1",
    //     "value": "127.0.0.1"
    // },
    // {
    //     "label": "::a",
    //     "value": "::a"
    // },
    // {
    //     "label": "::b",
    //     "value": "::b"
    // },
    // {
    //     "label": "192.168.30.126",
    //     "value": "192.168.30.126"
    // }];
}


/**
 * 生成二维码图片 tsc => preload =>  node
 * @param {*} ip 
 * @param {*} port 
 * @returns 
 */
export const UupdateQrImgPath = (ip, port) => {
    ip = String(ip);
    port = String(port);
    // console.log("UupdateQrImgPat:生成二维码图片：" + ip + ":" + port);
    return window.getQrImgPath(ip, port);
}