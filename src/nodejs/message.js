const L = require('list');
const AES_Util = require("./crypto");

/**
 * 加密的Msg类 解密请在App中实现，此类不包含解密的任何功能
 */
class Message {
    constructor(stringText, length, id, notes) {
        // 加密的数据
        this.encrypt_data = L.empty();
        // id
        this.id = undefined;
        // 留言
        this.notes = undefined;

        if (stringText != undefined) {
            console.log("封装字符串：" + stringText);
        }
        this.setId(id);
        if (notes != undefined) {
            this.setNotes(notes);
        } else {
            this.setNotes("undefined");
        }
        if (stringText != undefined) {
            // 需要截取的长度
            let r_len = length; // 10
            let t_len = stringText.length; // 15
            let start = 0;
            let end = 0;
            // 000 000 000 0 3 10 0,3 3,6 6,9
            while (t_len > r_len) { // 15 > 10
                end += r_len;
                this.addData(this.encryptData(stringText.substring(start, end)));
                start += r_len;
                t_len -= r_len;
            }
            let e = stringText.substring(start);
            if (e != "") {
                this.addData(this.encryptData(e));
            }
        }
    }

    // 加密(解密功能定义在接受端)
    encryptData(msg) {
        return AES_Util.encrypt(msg);
    }

    // 打印 : foreach log无效
    printData() {
        console.log(this.getData());
    }

    getNotes() {
        return this.notes;
    }
    setNotes(notes) {
        this.notes = notes;
    }
    getData() {
        return this.encrypt_data;
    }
    getDataArray(){
        return L.toArray(this.encrypt_data);
    }
    addData(string) {
        this.encrypt_data = L.append(string, this.encrypt_data);
    }
    getId() {
        return this.id;
    }
    setId(id) {
        this.id = id;
    }
}

// let msg = new Message("12345678901234567890123", 10, 2, undefined);
// msg.printData();
// console.log(msg.getDataArray());

module.exports = {
    Message,
}
