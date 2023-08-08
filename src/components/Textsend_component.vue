<template>
  <div class="textsend-component">
    <div class="input">
      <div class="input-padding-div">
        <!-- 下面div有多大，文本输入框就有多大 -->
        <div class="input-div">
          <n-input class="input-textarea" v-model:value="value" type="textarea" clearable="true" placeholder="请输入要发送的文字"
            show-count />
        </div>
      </div>
    </div>

    <div class="buttons">
      <span class="select-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-select v-model:value="ipAddr" :options="ipAddrList" :size="large" :on-update-value="updateIpAddr" />
          </template>
          请选择本机IP
        </n-tooltip>
      </span>
      <span class="input-span">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-input-number v-model:value="portNumber" :validator="portNumberValidator" :size="large" :max="65535"
              :placeholder="端口号" :format="portNumberFormator" :on-update-value="updatePort" />
          </template>
          默认是 54300 端口。
        </n-tooltip>
      </span>
      <n-button size="large" class="button" @click="btnLaunch"><span> 启&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;动 </span></n-button>
      <n-button size="large" class="button" @click="btnChangeMode"><span> 切&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;换
        </span></n-button>
      <n-button size="large" class="button" @click="btnAbout"><span> 关&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;于 </span></n-button>
    </div>
  </div>
</template>

<script setup>
import { NInput, NButton, NSelect, NInputNumber, NTooltip } from "naive-ui";
import { ref, reactive } from "vue"

// 定义
/**
 * 更新IP地址列表(选择框)
 */
const getIpAddrList = () => {
  let ips = window.getIpAddr();
  let ipA = [];
  for (let i = 0; i < ips.length; i++) {
    let seel = { label: ips[i], value: ips[i] }
    ipA.push(seel);
  }
  console.log("返回IP列表:" + ipA);
  return ipA;
}


/**
 * 配置默认的IP
 * @param {ref {IP数组} array 
 */
const setDefaultIpAddr = (array) => {
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

/**
 *  定义变量 
 */
const props = defineProps(['serverMode']);

console.log(props.serverMode);
const emit = defineEmits(['']);
// 默认值
const defaultValue = ref(" - ");
// 默认端口
let portNumber = ref(54300);

// 初始化
// E:ELECTRON MODE
// let ipAddrList = ref(getIpAddrList());
// V:VUE MODE
let ipAddrList = ref([
  {
    "label": "127.0.0.1",
    "value": "127.0.0.1"
  },
  {
    "label": "::1",
    "value": "::1"
  },
  {
    "label": "192.168.30.126",
    "value": "192.168.30.126"
  },
  {
    "label": "fe80::abf:b8ff:fe3f:2faa",
    "value": "fe80::abf:b8ff:fe3f:2faa"
  },
  {
    "label": "10.147.18.226",
    "value": "10.147.18.226"
  },
  {
    "label": "fe80::cc34:2fff:febb:94dc",
    "value": "fe80::cc34:2fff:febb:94dc"
  },
  {
    "label": "10.147.19.226",
    "value": "10.147.19.226"
  },
  {
    "label": "fe80::306c:92ff:feca:bd52",
    "value": "fe80::306c:92ff:feca:bd52"
  }
]);
let ipAddr = ref(setDefaultIpAddr(ipAddrList.value));


/**
 * 验证端口号是否合规 （要求大于0） 
 * @param {Number} x 
 */
const portNumberValidator = (x) => x > 0;

/**
 * 格式化为整数
 * @param {Number} value 
 */
const portNumberFormator = (value) => {
  if ((value % 1) != 0)
    return parseInt(value); 
  return value;
}

/**
 * 更新端口号
 * @param {Number} x
 */
const updatePort = (x) => {
  console.log(x);
};


/**
 * 下面是按钮事件
 */
const btnLaunch = () => {

}
const btnChangeMode = () => {

}
const btnAbout = () => {

}

</script>


<style scoped lang="less">
// 总体
.textsend-component {
  height: 100%;
  width: 100%;
}

// 上:输入框部分div 9/10
.input {
  height: 90%;

  .input-padding-div {
    padding: 40px;
    box-sizing: border-box;
    height: 100%;
  }

  .input-div {
    // height: calc((100% - 2*20px));
    height: 100%;
  }

  // 输入框
  .input-textarea {
    height: 100%;
    font-size: 33px;
  }
}

// 下:按钮部分div 1/10
.buttons {
  width: 100%;
  height: 10%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;

  // 选择框span
  .select-span {
    width: 200px;
    text-align: center;
  }

  // 文本框span
  .input-span {
    width: 130px;
    text-align: center;
  }

  // 按钮
  .button {
    font-size: 20px;
  }
}
</style>


