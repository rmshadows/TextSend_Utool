// 进入插件调用的
utools.onPluginEnter(({ code, type, payload, option }) => {
  console.log('用户进入插件应用', code, type, payload)
});

const msystem = require("../src/system");
console.log(msystem.getIpAddr());



