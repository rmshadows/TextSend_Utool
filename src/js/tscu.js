/**
 * 更新IP地址列表(选择框)
 */
export const getIpAddrList = () => {
    // TODO:DEBUG
    // let ips = window.getIpAddr();
    // let ipA = [];
    // for (let i = 0; i < ips.length; i++) {
    //   let seel = { label: ips[i], value: ips[i] }
    //   ipA.push(seel);
    // }
    // console.log("返回IP列表:" + ipA);
    // return ipA;
    return [{
        "label": "127.0.0.1",
        "value": "127.0.0.1"
    },
    {
        "label": "::a",
        "value": "::a"
    },
    {
        "label": "::b",
        "value": "::b"
    },
    {
        "label": "192.168.30.126",
        "value": "192.168.30.126"
    }];
}


export const updateQrImgPath = (ip, port) => {
    // TODO: DEBUG
    console.log("生成二维码图片：" + ip, +":" + port);
    return "qrcode.png"
    // return window.getQrImgPath(ip, port);
}