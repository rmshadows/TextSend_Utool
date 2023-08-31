
const maes = require("./maes.cjs");

// 导出加密器
const Cipher = new maes.cfbCipher("119", "", 32);
let a = Cipher.encrypt("妳好Hello@");
console.log(a);

